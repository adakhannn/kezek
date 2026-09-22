jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { approveStaffApplication, isBusinessOwner } from '@/lib/staffApplicationApprovalService';

const mockedInitializeStaffSchedule = initializeStaffSchedule as jest.MockedFunction<typeof initializeStaffSchedule>;

function query(result: unknown) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(result),
    };
}

describe('staffApplicationApprovalService', () => {
    test('explicit scheduling grants access without inventing working hours', async () => {
        const previous = process.env.SCHEDULE_V2_ENABLED;
        process.env.SCHEDULE_V2_ENABLED = 'true';
        try {
            const admin = { from: jest.fn(), rpc: jest.fn().mockResolvedValue({
                data: [{ staff_id: 'staff-1', biz_id: 'biz-1', branch_id: 'branch-1' }], error: null,
            }) };
            const result = await approveStaffApplication({ admin, applicationId: 'a', reviewerUserId: 'owner-1', branchId: 'branch-1', isActive: true });
            expect(result).toMatchObject({ ok: true, schedule: { initialized: false, daysCreated: 0, error: null } });
            expect(mockedInitializeStaffSchedule).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) delete process.env.SCHEDULE_V2_ENABLED;
            else process.env.SCHEDULE_V2_ENABLED = previous;
        }
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('recognizes the primary business owner', async () => {
        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'businesses') {
                    return query({ data: { owner_id: 'owner-1' }, error: null });
                }
                throw new Error(`Unexpected table ${table}`);
            }),
            rpc: jest.fn(),
        };

        await expect(isBusinessOwner({
            admin,
            userId: 'owner-1',
            bizId: 'biz-1',
        })).resolves.toBe(true);
    });

    test('recognizes a co-owner role assignment', async () => {
        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'businesses') {
                    return query({ data: { owner_id: 'other-owner' }, error: null });
                }
                if (table === 'roles') {
                    return query({ data: { id: 'owner-role' }, error: null });
                }
                if (table === 'user_roles') {
                    return query({ data: { id: 'assignment-1' }, error: null });
                }
                throw new Error(`Unexpected table ${table}`);
            }),
            rpc: jest.fn(),
        };

        await expect(isBusinessOwner({
            admin,
            userId: 'owner-2',
            bizId: 'biz-1',
        })).resolves.toBe(true);
    });

    test('atomically approves and initializes the staff schedule', async () => {
        const admin = {
            from: jest.fn(),
            rpc: jest.fn().mockResolvedValue({
                data: [{ staff_id: 'staff-1', biz_id: 'biz-1', branch_id: 'branch-1' }],
                error: null,
            }),
        };
        mockedInitializeStaffSchedule.mockResolvedValue({ success: true, daysCreated: 14 });

        const result = await approveStaffApplication({
            admin,
            applicationId: 'application-1',
            reviewerUserId: 'owner-1',
            branchId: 'branch-1',
            isActive: true,
        });

        expect(admin.rpc).toHaveBeenCalledWith('approve_staff_application', {
            p_application_id: 'application-1',
            p_reviewer_user_id: 'owner-1',
            p_branch_id: 'branch-1',
            p_is_active: true,
        });
        expect(mockedInitializeStaffSchedule).toHaveBeenCalledWith(
            admin,
            'biz-1',
            'staff-1',
            'branch-1',
        );
        expect(result).toEqual({
            ok: true,
            staffId: 'staff-1',
            bizId: 'biz-1',
            branchId: 'branch-1',
            schedule: { initialized: true, daysCreated: 14, error: null },
        });
    });

    test('does not initialize a schedule when the transaction fails', async () => {
        const admin = {
            from: jest.fn(),
            rpc: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'invalid_or_inactive_branch' },
            }),
        };

        const result = await approveStaffApplication({
            admin,
            applicationId: 'application-1',
            reviewerUserId: 'owner-1',
            branchId: 'wrong-branch',
            isActive: true,
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            message: 'Выбранный филиал не найден или неактивен.',
        });
        expect(mockedInitializeStaffSchedule).not.toHaveBeenCalled();
    });
});
