import { runDashboardStaffShiftOpen } from '@/lib/dashboardStaffShiftOpenService';

describe('dashboardStaffShiftOpenService', () => {
    const supabase = {
        from: jest.fn(),
    };
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error when staff has no branch', async () => {
        const result = await runDashboardStaffShiftOpen({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/shift/open'),
            supabase,
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: {
                branch_id: null,
            },
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message:
                'У сотрудника не указан филиал. Укажите филиал в карточке сотрудника и попробуйте снова.',
        });
    });
});

