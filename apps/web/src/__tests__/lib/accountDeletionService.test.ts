import { assessAccountDeletion, requestAccountDeletion } from '@/lib/accountDeletionService';

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

function createAssessmentAdmin(counts: Record<string, number>) {
    return {
        from: jest.fn((table: string) => countChain(counts[table] ?? 0)),
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
