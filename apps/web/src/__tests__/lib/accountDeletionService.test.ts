import { assessAccountDeletion, cancelAccountDeletion, releaseBlockedAccountDeletions, requestAccountDeletion } from '@/lib/accountDeletionService';

function countChain(count: number) {
    const result = { count, error: null };
    const chain = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        gte: jest.fn(),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    return chain;
}

function createAssessmentAdmin(counts: Record<string, number>, superAdmins: string[] = []) {
    return {
        from: jest.fn((table: string) => countChain(counts[table] ?? 0)),
        rpc: jest.fn().mockResolvedValue({ data: superAdmins, error: null }),
    };
}

describe('accountDeletionService', () => {
    test('returns role-specific blockers for owner, staff, business roles and active bookings', async () => {
        const admin = createAssessmentAdmin({ businesses: 2, user_roles: 1, staff: 1, bookings: 3 });

        const blockers = await assessAccountDeletion(admin as never, 'user-id');

        expect(blockers.map((blocker) => blocker.code)).toEqual([
            'owned_businesses',
            'business_roles',
            'active_staff',
            'active_bookings',
        ]);
    });

    // DB-10: a super admin recorded in any store blocks the deletion, not only one in user_roles.
    test('blocks a super admin found by the shared rule', async () => {
        const admin = createAssessmentAdmin({}, ['other-admin', 'user-id']);

        const blockers = await assessAccountDeletion(admin as never, 'user-id');

        expect(blockers.map((blocker) => blocker.code)).toEqual(['super_admin']);
        expect(admin.rpc).toHaveBeenCalledWith('super_admin_user_ids');
        expect(admin.from).not.toHaveBeenCalledWith('user_roles_with_user');
    });

    test('a failed super-admin read fails the assessment', async () => {
        const admin = createAssessmentAdmin({});
        admin.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

        await expect(assessAccountDeletion(admin as never, 'user-id')).rejects.toMatchObject({
            message: 'Account deletion assessment failed',
            cause: { message: 'timeout' },
        });
    });

    test('rejects an unrecognized confirmation phrase before accessing persistence', async () => {
        const result = await requestAccountDeletion({} as never, 'user-id', 'подтвердить');

        expect(result).toEqual({
            ok: false,
            status: 400,
            message: 'Введите УДАЛИТЬ для подтверждения.',
            code: 'confirmation_required',
        });
    });

    test.each(['УДАЛИТЬ', ' удалить ', 'DELETE', 'delete', 'ӨЧҮРҮҮ', ' өчүрүү '])(
        'accepts localized confirmation %s without bypassing ownership blockers', async (confirmation) => {
            const admin = createAssessmentAdmin({ businesses: 1 });
            const result = await requestAccountDeletion(admin as never, 'user-id', confirmation);

            expect(result).toMatchObject({ ok: false, status: 409, code: 'deletion_blocked' });
            expect(result).toHaveProperty('blockers', [expect.objectContaining({ code: 'owned_businesses', count: 1 })]);
            expect(admin.from).not.toHaveBeenCalledWith('account_deletion_requests');
        },
    );
});

type Call = { method: string; args: unknown[] };

/** Table chains for the release/cancel paths plus counts for the assessment and an auth admin mock. */
function createLifecycleAdmin(options: {
    blocked?: Array<{ user_id: string; preference_snapshot: unknown }>;
    pending?: { preference_snapshot: unknown } | null;
    counts?: Record<string, number>;
    closed?: boolean;
    profileError?: unknown;
}) {
    const log: Array<{ table: string; calls: Call[] }> = [];
    const from = jest.fn((table: string) => {
        const calls: Call[] = [];
        log.push({ table, calls });
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'update', 'eq', 'in', 'gte', 'is', 'order', 'limit', 'maybeSingle']) {
            chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
        }
        chain.then = (done: (value: unknown) => unknown) => {
            const methods = calls.map(c => c.method);
            let result: Record<string, unknown> = { data: null, error: null };
            if (table === 'account_deletion_requests' && methods.includes('limit')) result = { data: options.blocked ?? [], error: null };
            else if (table === 'account_deletion_requests' && methods.includes('maybeSingle')) result = { data: options.pending ?? null, error: null };
            else if (table === 'account_deletion_requests' && methods[0] === 'update') result = { data: options.closed === false ? [] : [{ user_id: 'u' }], error: null };
            else if (table === 'profiles') result = { data: null, error: options.profileError ?? null };
            else result = { count: options.counts?.[table] ?? 0, error: null };
            return Promise.resolve(done(result));
        };
        return chain;
    });
    const auth = { admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: { user_metadata: { full_name: 'Synthetic', account_deletion_pending: true } } } }),
        updateUserById: jest.fn().mockResolvedValue({ error: null }),
    } };
    return { admin: { from, rpc: jest.fn().mockResolvedValue({ data: [], error: null }), auth }, log, auth };
}

describe('blocked account deletion requests', () => {
    test('a newly blocked request gives the notifications back, clears the pending marks and is closed once', async () => {
        const { admin, log, auth } = createLifecycleAdmin({
            blocked: [{ user_id: 'u', preference_snapshot: { notify_email: true, notify_whatsapp: false, notify_telegram: true, unknown: 1 } }],
            counts: { bookings: 2 },
        });

        await expect(releaseBlockedAccountDeletions(admin as never)).resolves.toBe(1);

        const lookup = log.find(entry => entry.calls.some(c => c.method === 'limit'))!;
        expect(lookup.calls).toEqual(expect.arrayContaining([
            { method: 'eq', args: ['status', 'blocked'] },
            { method: 'is', args: ['cancelled_at', null] },
        ]));
        const profile = log.find(entry => entry.table === 'profiles')!;
        expect(profile.calls[0]).toEqual({ method: 'update', args: [{ notify_email: true, notify_whatsapp: false, notify_telegram: true }] });
        expect(auth.admin.updateUserById).toHaveBeenCalledWith('u', { user_metadata: {
            full_name: 'Synthetic', account_deletion_pending: null, account_deletion_scheduled_for: null,
        } });
        const close = log.filter(entry => entry.table === 'account_deletion_requests' && entry.calls[0]?.method === 'update')[0];
        expect(close.calls[0].args[0]).toMatchObject({ blocker_snapshot: [{ code: 'active_bookings', count: 2 }] });
        expect(close.calls).toEqual(expect.arrayContaining([
            { method: 'eq', args: ['status', 'blocked'] },
            { method: 'is', args: ['cancelled_at', null] },
        ]));
        // The request stays blocked: nothing deletes the account later without a new request.
        expect(close.calls[0].args[0]).not.toHaveProperty('status');
    });

    test('a request the user renewed in the meantime is not counted, and a failed restore fails the release', async () => {
        let mock = createLifecycleAdmin({ blocked: [{ user_id: 'u', preference_snapshot: {} }], closed: false });
        await expect(releaseBlockedAccountDeletions(mock.admin as never)).resolves.toBe(0);
        mock = createLifecycleAdmin({ blocked: [{ user_id: 'u', preference_snapshot: { notify_email: true } }], profileError: { message: 'down' } });
        await expect(releaseBlockedAccountDeletions(mock.admin as never)).rejects.toThrow('Не удалось сохранить настройки уведомлений');
        expect(mock.log.some(entry => entry.table === 'account_deletion_requests' && entry.calls[0]?.method === 'update')).toBe(false);
    });

    test('cancelling a pending request restores the saved switches and clears the marks', async () => {
        const { admin, log, auth } = createLifecycleAdmin({ pending: { preference_snapshot: { notify_email: false, notify_telegram: true } } });
        await expect(cancelAccountDeletion(admin as never, 'u')).resolves.toEqual({ ok: true });
        expect(log.find(entry => entry.table === 'profiles')!.calls[0]).toEqual({ method: 'update', args: [{ notify_email: false, notify_telegram: true }] });
        expect(auth.admin.updateUserById).toHaveBeenCalledWith('u', expect.objectContaining({ user_metadata: expect.objectContaining({ account_deletion_pending: null }) }));
    });
});
