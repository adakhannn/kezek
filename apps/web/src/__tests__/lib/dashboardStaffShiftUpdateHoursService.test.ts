import { updateDashboardShiftHours, type DashboardShiftHoursAdminLike } from '@/lib/dashboardStaffShiftUpdateHoursService';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

jest.mock('@/lib/dbHelpers', () => ({
  checkResourceBelongsToBiz: jest.fn(),
}));

describe('dashboardStaffShiftUpdateHoursService', () => {
  const shiftId = 'shift-uuid';
  const bizId = 'biz-uuid';

  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<DashboardShiftHoursAdminLike>;
  }

  test('rejects missing shift access', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: 'Resource not found',
    });

    const result = await updateDashboardShiftHours({
      admin,
      bizId,
      shiftId,
      hoursWorked: 8,
    });

    expect(result).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Смена не найдена или доступ запрещен',
      status: 404,
    });
  });

  test('rejects non-closed shift', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: {
        id: shiftId,
        biz_id: bizId,
        staff_id: 'staff-id',
        status: 'open',
        total_amount: 10000,
        consumables_amount: 1000,
        percent_master: 60,
        percent_salon: 40,
        hourly_rate: 500,
        guaranteed_amount: 0,
        master_share: 0,
        salon_share: 0,
        topup_amount: 0,
      },
      error: null,
    });

    const result = await updateDashboardShiftHours({
      admin,
      bizId,
      shiftId,
      hoursWorked: 8,
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Можно изменять только закрытые смены',
      status: 400,
    });
  });

  test('recalculates guaranteed payout and updates shift', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: {
        id: shiftId,
        biz_id: bizId,
        staff_id: 'staff-id',
        status: 'closed',
        total_amount: 10000,
        consumables_amount: 1000,
        percent_master: 60,
        percent_salon: 40,
        hourly_rate: 500,
        guaranteed_amount: 0,
        master_share: 0,
        salon_share: 0,
        topup_amount: 0,
      },
      error: null,
    });

    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: shiftId, hours_worked: 8, guaranteed_amount: 4000 },
        error: null,
      }),
    };
    admin.from.mockReturnValueOnce(updateChain);

    const result = await updateDashboardShiftHours({
      admin,
      bizId,
      shiftId,
      hoursWorked: 8,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        shift: { id: shiftId, hours_worked: 8, guaranteed_amount: 4000 },
      },
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        hours_worked: 8,
        guaranteed_amount: 4000,
        master_share: 6000,
        salon_share: 5000,
        topup_amount: 0,
      }),
    );
  });
});
