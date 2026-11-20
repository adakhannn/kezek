jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

jest.mock('@/lib/businessRoleApplicationNotificationService', () => ({
    notifyStaffInvitationCreated: jest.fn(),
}));

jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn(), logWarn: jest.fn() }));

import { createTableMock, expectBusinessScoped, type RecordedQuery } from '../api/testHelpers';

import { notifyStaffInvitationCreated } from '@/lib/businessRoleApplicationNotificationService';
import { logWarn } from '@/lib/log';
import { runStaffCreate } from '@/lib/staffCreateService';
import { initializeStaffSchedule } from '@/lib/staffSchedule';

const has = (query: RecordedQuery, method: string) => query.calls.some(([name]) => name === method);

describe('staffCreateService (API-06: no linking, silent invitation)', () => {
    const bizId = 'biz-id';
    const managerId = 'user-id';
    const body = { full_name: 'Test Staff', email: 'test@example.com', branch_id: 'branch-id', is_active: true };

    function sessionClient(roles: unknown[]) {
        return createTableMock({
            user_roles: { data: roles },
            staff: (query) => (has(query, 'insert') ? { data: { id: 'staff-id' } } : { data: null }),
        });
    }

    function adminClient({ accounts = [] as unknown[], ownCard = null as unknown, pending = null as unknown, invitationInsert = { data: { id: 'inv-id', staff_id: 'staff-id' } } as unknown } = {}) {
        const admin = createTableMock({
            staff: { data: ownCard },
            staff_invitations: (query) => (has(query, 'insert') ? invitationInsert as { data?: unknown; error?: unknown } : { data: pending }),
            staff_branch_assignments: { data: null },
            businesses: { data: { name: 'Test Biz' } },
            branches: { data: { name: 'Main' } },
        });
        admin.rpc.mockResolvedValue({ data: accounts, error: null });
        return admin;
    }

    const run = (supabase: ReturnType<typeof sessionClient>, admin: ReturnType<typeof adminClient>, input = body) =>
        runStaffCreate({ supabase: supabase as never, admin: admin as never, userId: managerId, bizId, body: input });

    const expected = {
        ok: true,
        data: { id: 'staff-id', schedule_initialized: true, schedule_days_created: 14, schedule_error: null },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (initializeStaffSchedule as jest.Mock).mockResolvedValue({ success: true, daysCreated: 14 });
        (notifyStaffInvitationCreated as jest.Mock).mockResolvedValue(undefined);
    });

    test('returns forbidden when caller has no manager role in business', async () => {
        const result = await run(sessionClient([]), adminClient());

        expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: 'Доступ запрещен' });
    });

    test('never links the card; the confirmed account gets a pending invitation and no role', async () => {
        const supabase = sessionClient([{ roles: { key: 'owner' } }]);
        const admin = adminClient({ accounts: [{ id: 'account-id' }] });

        const result = await run(supabase, admin);

        expect(result).toEqual(expected);
        const insert = supabase.queries.find((query) => query.table === 'staff' && has(query, 'insert'));
        expect(insert?.calls.find(([name]) => name === 'insert')?.[1]).toMatchObject({ user_id: null, biz_id: bizId });
        expect(admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', expect.objectContaining({ p_email: 'test@example.com' }));
        const invitation = admin.queries.find((query) => query.table === 'staff_invitations' && has(query, 'insert'));
        expect(invitation?.calls.find(([name]) => name === 'insert')?.[1]).toEqual({
            biz_id: bizId, staff_id: 'staff-id', invited_user_id: 'account-id', invited_by: managerId,
        });
        expect(admin.queries.map((query) => query.table)).not.toContain('user_roles');
        expectBusinessScoped(admin, 'staff', bizId);
        expectBusinessScoped(admin, 'staff_invitations', bizId);
    });

    // The response must not reveal whether an account with this contact exists.
    test('the response is the same with and without a matching account', async () => {
        const withAccount = await run(sessionClient([{ roles: { key: 'owner' } }]), adminClient({ accounts: [{ id: 'account-id' }] }));
        const withoutAccount = await run(sessionClient([{ roles: { key: 'owner' } }]), adminClient({ accounts: [] }));

        expect(withAccount).toEqual(expected);
        expect(withoutAccount).toEqual(expected);
        expect(withAccount.ok && 'user_linked' in withAccount.data).toBe(false);
    });

    test('no invitation when the account already has a card or a pending invitation in the business', async () => {
        const withCard = adminClient({ accounts: [{ id: 'account-id' }], ownCard: { id: 'own-card' } });
        await run(sessionClient([{ roles: { key: 'owner' } }]), withCard);
        const withPending = adminClient({ accounts: [{ id: 'account-id' }], pending: { id: 'inv-old', staff_id: 'other-card' } });
        await run(sessionClient([{ roles: { key: 'owner' } }]), withPending);

        for (const admin of [withCard, withPending]) {
            expect(admin.queries.some((query) => query.table === 'staff_invitations' && has(query, 'insert'))).toBe(false);
        }
    });

    test('a failed account lookup still creates the card, without an invitation', async () => {
        const admin = adminClient();
        admin.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

        const result = await run(sessionClient([{ roles: { key: 'owner' } }]), admin);

        expect(result).toEqual(expected);
        expect(admin.queries.map((query) => query.table)).not.toContain('staff_invitations');
    });

    test('a new invitation is announced to the matched account', async () => {
        const admin = adminClient({ accounts: [{ id: 'account-id' }] });
        await run(sessionClient([{ roles: { key: 'owner' } }]), admin);

        expect(notifyStaffInvitationCreated).toHaveBeenCalledWith(admin, { invitedUserId: 'account-id', businessName: 'Test Biz', branchName: 'Main' });
        expectBusinessScoped(admin, 'branches', bizId);
    });

    test('no announcement without a new invitation: own card, pending one, or a concurrent one', async () => {
        const owner = () => sessionClient([{ roles: { key: 'owner' } }]);
        await run(owner(), adminClient({ accounts: [{ id: 'account-id' }], ownCard: { id: 'own-card' } }));
        await run(owner(), adminClient({ accounts: [{ id: 'account-id' }], pending: { id: 'inv-old', staff_id: 'other-card' } }));
        await run(owner(), adminClient({ accounts: [] }));
        // 23505: another card got the invitation first; createPendingStaffInvitation returns that one.
        let lookups = 0;
        const concurrent = createTableMock({
            staff: { data: null },
            staff_invitations: (query) => {
                if (has(query, 'insert')) return { error: { code: '23505', message: 'duplicate' } };
                lookups += 1;
                return lookups === 1 ? { data: null } : { data: { id: 'inv-first', staff_id: 'other-card' } };
            },
        });
        concurrent.rpc.mockResolvedValue({ data: [{ id: 'account-id' }], error: null });
        await run(owner(), concurrent as never);

        expect(notifyStaffInvitationCreated).not.toHaveBeenCalled();
    });

    test('a failed announcement does not fail the card or the invitation', async () => {
        (notifyStaffInvitationCreated as jest.Mock).mockRejectedValue(new Error('smtp down'));
        const admin = adminClient({ accounts: [{ id: 'account-id' }] });

        const result = await run(sessionClient([{ roles: { key: 'owner' } }]), admin);

        expect(result).toEqual(expected);
        expect(admin.queries.some((query) => query.table === 'staff_invitations' && has(query, 'insert'))).toBe(true);
        expect(logWarn).toHaveBeenCalledWith('StaffInvitationNotification', 'Staff invitation notification failed', expect.any(Error));
    });

    test('no contact, no lookup', async () => {
        const admin = adminClient();
        await run(sessionClient([{ roles: { key: 'owner' } }]), admin, { full_name: 'Test Staff', branch_id: 'branch-id', is_active: true } as typeof body);

        expect(admin.rpc).not.toHaveBeenCalled();
    });
});
