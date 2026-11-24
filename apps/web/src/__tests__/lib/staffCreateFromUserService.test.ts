jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

jest.mock('@/lib/businessRoleApplicationNotificationService', () => ({
    notifyStaffInvitationCreated: jest.fn(),
}));

jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn(), logWarn: jest.fn() }));

import { createTableMock, expectBusinessScoped, type RecordedQuery } from '../api/testHelpers';

import { notifyStaffInvitationCreated } from '@/lib/businessRoleApplicationNotificationService';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logWarn } from '@/lib/log';
import { runStaffCreateFromUser } from '@/lib/staffCreateFromUserService';
import { initializeStaffSchedule } from '@/lib/staffSchedule';

const has = (query: RecordedQuery, method: string) => query.calls.some(([name]) => name === method);
const argsOf = (query: RecordedQuery, method: string) => query.calls.find(([name]) => name === method)?.slice(1);

describe('staffCreateFromUserService (API-06: invitation instead of linking)', () => {
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';
    const userId = 'user-uuid';
    const managerId = 'manager-uuid';

    type Answers = {
        ownCard?: { data?: unknown; error?: unknown };
        pending?: { data?: unknown; error?: unknown };
        /** The card of a pending invitation (its branch); by default in the requested branch. */
        pendingCard?: { data?: unknown; error?: unknown };
        staffInsert?: { data?: unknown; error?: unknown };
        invitationInsert?: { data?: unknown; error?: unknown };
    };

    function client(answers: Answers = {}) {
        const admin = createTableMock({
            staff: (query) => {
                if (has(query, 'insert')) return answers.staffInsert ?? { data: { id: 'staff-new' } };
                if (has(query, 'delete')) return {};
                if (query.calls.some(([method, column]) => method === 'eq' && column === 'id')) {
                    return answers.pendingCard ?? { data: { branch_id: branchId } };
                }
                return answers.ownCard ?? { data: null };
            },
            staff_invitations: (query) => {
                if (has(query, 'insert')) return answers.invitationInsert ?? { data: { id: 'inv-new', staff_id: 'staff-new' } };
                return answers.pending ?? { data: null };
            },
            staff_branch_assignments: { data: null },
            businesses: { data: { name: 'Test Biz' } },
            branches: { data: { name: 'Main' } },
        });
        admin.auth.admin.getUserById.mockResolvedValue({
            data: { user: { id: userId, email: 'test@example.com', phone: '+996555123456', user_metadata: { full_name: 'Test User' } } },
            error: null,
        });
        return admin;
    }

    const run = (admin: ReturnType<typeof client>, body: Record<string, unknown> = { user_id: userId, branch_id: branchId, is_active: true }) =>
        runStaffCreateFromUser({ admin: admin as never, bizId, invitedBy: managerId, body: body as never });

    const tables = (admin: ReturnType<typeof client>) => admin.queries.map((query) => query.table);

    beforeEach(() => {
        jest.clearAllMocks();
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({ data: { id: branchId, biz_id: bizId }, error: null });
        (initializeStaffSchedule as jest.Mock).mockResolvedValue({ success: true, daysCreated: 14 });
        (notifyStaffInvitationCreated as jest.Mock).mockResolvedValue(undefined);
    });

    test('returns validation error when required fields are missing', async () => {
        const result = await run(client(), { user_id: '', branch_id: '' });
        expect(result).toEqual({ ok: false, status: 400, error: 'validation', message: 'user_id и branch_id обязательны' });
    });

    test('creates an unlinked card and a pending invitation; grants no role', async () => {
        const admin = client();
        const result = await run(admin);

        expect(result).toEqual({
            ok: true,
            message: 'Приглашение отправлено. Сотрудник появится в команде после подтверждения.',
            data: {
                id: 'staff-new',
                staff_id: 'staff-new',
                invitation_id: 'inv-new',
                status: 'pending',
                schedule_initialized: true,
                schedule_days_created: 14,
                schedule_error: null,
            },
        });
        const staffInsert = admin.queries.find((query) => query.table === 'staff' && has(query, 'insert'));
        // The card does not get the account, nor its e-mail and phone.
        expect(argsOf(staffInsert!, 'insert')?.[0]).toEqual({
            biz_id: bizId, branch_id: branchId, full_name: 'Test User', is_active: true, user_id: null,
        });
        const invitationInsert = admin.queries.find((query) => query.table === 'staff_invitations' && has(query, 'insert'));
        expect(argsOf(invitationInsert!, 'insert')?.[0]).toEqual({
            biz_id: bizId, staff_id: 'staff-new', invited_user_id: userId, invited_by: managerId,
        });
        expect(tables(admin)).not.toContain('user_roles');
        expect(tables(admin)).not.toContain('roles');
        expect(initializeStaffSchedule).toHaveBeenCalledWith(admin, bizId, 'staff-new', branchId);
        expectBusinessScoped(admin, 'staff', bizId);
        expectBusinessScoped(admin, 'staff_invitations', bizId);
        expectBusinessScoped(admin, 'staff_branch_assignments', bizId);
    });

    test('a repeated request reuses the pending invitation and its card', async () => {
        const admin = client({ pending: { data: { id: 'inv-old', staff_id: 'staff-old' } } });
        const result = await run(admin);

        expect(result).toMatchObject({ ok: true, data: { id: 'staff-old', staff_id: 'staff-old', invitation_id: 'inv-old', status: 'pending' } });
        expect(admin.queries.some((query) => has(query, 'insert') && query.table !== 'staff_branch_assignments')).toBe(false);
        const lookup = admin.queries.find((query) => query.table === 'staff_invitations');
        expect(lookup?.calls).toEqual(expect.arrayContaining([
            ['eq', 'biz_id', bizId], ['eq', 'invited_user_id', userId], ['eq', 'status', 'pending'],
        ]));
    });

    test('a pending invitation to another branch is refused; its card gets no second branch', async () => {
        const admin = client({
            pending: { data: { id: 'inv-old', staff_id: 'staff-old' } },
            pendingCard: { data: { branch_id: 'other-branch' } },
        });
        const result = await run(admin);

        expect(result).toMatchObject({ ok: false, status: 409, error: 'conflict' });
        expect(tables(admin)).not.toContain('staff_branch_assignments');
        expect(initializeStaffSchedule).not.toHaveBeenCalled();
        const cardLookup = admin.queries.find((query) => query.table === 'staff' && query.calls.some(([m, c]) => m === 'eq' && c === 'id'));
        expect(cardLookup?.calls).toEqual(expect.arrayContaining([['eq', 'id', 'staff-old'], ['eq', 'biz_id', bizId]]));
    });

    // ARCH-07: a namesake's card is never linked to this account or returned as its card.
    test('keeps the card already linked to the account and never matches a card by name', async () => {
        const admin = client({ ownCard: { data: { id: 'own-card' } } });
        const result = await run(admin);

        const lookup = admin.queries[0];
        expect(lookup.table).toBe('staff');
        expect(lookup.calls).toEqual(expect.arrayContaining([['eq', 'biz_id', bizId], ['eq', 'user_id', userId]]));
        expect(lookup.calls.some(([, column]) => column === 'full_name')).toBe(false);
        expect(admin.queries.filter((query) => query.table === 'staff')).toHaveLength(1);
        expect(tables(admin)).not.toContain('staff_invitations');
        expect(result).toMatchObject({
            ok: true,
            message: 'Этот пользователь уже в команде бизнеса.',
            data: { id: 'own-card', invitation_id: null, status: 'already_staff' },
        });
    });

    test('a failed lookup of existing cards is a server error, not a new card', async () => {
        const admin = client({ ownCard: { error: { message: 'timeout' } } });
        const result = await run(admin);

        expect(result).toMatchObject({ ok: false, status: 500, error: 'internal' });
        expect(admin.queries).toHaveLength(1);
    });

    test('a failed lookup of pending invitations is a server error, not a new card', async () => {
        const admin = client({ pending: { error: { message: 'timeout' } } });
        const result = await run(admin);

        expect(result).toEqual({ ok: false, status: 500, error: 'internal', message: 'Не удалось проверить приглашения' });
        expect(admin.queries.some((query) => has(query, 'insert'))).toBe(false);
    });

    test('removes the new card when the invitation cannot be created', async () => {
        const admin = client({ invitationInsert: { error: { message: 'boom', code: 'XX000' } } });
        const result = await run(admin);

        expect(result).toEqual({ ok: false, status: 500, error: 'internal', message: 'Не удалось создать приглашение' });
        const removal = admin.queries.find((query) => query.table === 'staff' && has(query, 'delete'));
        expect(removal?.calls).toEqual(expect.arrayContaining([['eq', 'id', 'staff-new'], ['eq', 'biz_id', bizId]]));
        expect(initializeStaffSchedule).not.toHaveBeenCalled();
    });

    test('a concurrent invitation of the same person keeps its card; the new copy is removed', async () => {
        let lookups = 0;
        const admin = createTableMock({
            staff: (query) => (has(query, 'insert') ? { data: { id: 'staff-new' } } : { data: null }),
            staff_invitations: (query) => {
                if (has(query, 'insert')) return { error: { code: '23505', message: 'duplicate' } };
                lookups += 1;
                return lookups === 1 ? { data: null } : { data: { id: 'inv-first', staff_id: 'staff-first' } };
            },
            staff_branch_assignments: { data: null },
        });
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { id: userId, user_metadata: {} } }, error: null });

        const result = await run(admin as never);

        expect(result).toMatchObject({ ok: true, data: { staff_id: 'staff-first', invitation_id: 'inv-first', status: 'pending' } });
        const removal = admin.queries.find((query) => query.table === 'staff' && has(query, 'delete'));
        expect(removal?.calls).toEqual(expect.arrayContaining([['eq', 'id', 'staff-new']]));
        // The first request announced its own invitation.
        expect(notifyStaffInvitationCreated).not.toHaveBeenCalled();
    });

    test('a new invitation is announced to the invited person, with the business and branch names', async () => {
        const admin = client();
        await run(admin);

        expect(notifyStaffInvitationCreated).toHaveBeenCalledTimes(1);
        expect(notifyStaffInvitationCreated).toHaveBeenCalledWith(admin, { invitedUserId: userId, businessName: 'Test Biz', branchName: 'Main' });
        const business = admin.queries.find((query) => query.table === 'businesses');
        expect(business?.calls).toEqual(expect.arrayContaining([['eq', 'id', bizId]]));
        expectBusinessScoped(admin, 'branches', bizId);
    });

    test('a reused pending invitation is not announced again', async () => {
        await run(client({ pending: { data: { id: 'inv-old', staff_id: 'staff-old' } } }));
        expect(notifyStaffInvitationCreated).not.toHaveBeenCalled();
    });

    test('an account with its own card gets no announcement', async () => {
        await run(client({ ownCard: { data: { id: 'own-card' } } }));
        expect(notifyStaffInvitationCreated).not.toHaveBeenCalled();
    });

    test('a failed announcement does not fail the invitation', async () => {
        (notifyStaffInvitationCreated as jest.Mock).mockRejectedValue(new Error('smtp down'));
        const result = await run(client());

        expect(result).toMatchObject({ ok: true, data: { invitation_id: 'inv-new', status: 'pending' } });
        expect(logWarn).toHaveBeenCalledWith('StaffInvitationNotification', 'Staff invitation notification failed', expect.any(Error));
    });

    test('returns not_found when auth admin user is missing', async () => {
        const admin = client();
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'User not found' } });

        const result = await run(admin);

        expect(result).toEqual({ ok: false, status: 404, error: 'not_found', message: 'Пользователь не найден' });
        expect(admin.queries).toHaveLength(0);
    });
});
