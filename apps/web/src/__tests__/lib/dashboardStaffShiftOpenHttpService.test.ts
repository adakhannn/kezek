import { runDashboardStaffShiftOpenHttp } from '@/lib/dashboardStaffShiftOpenHttpService';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
  withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/dashboardStaffShiftOpenService', () => ({
  runDashboardStaffShiftOpen: jest.fn(),
}));

import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';
import { runDashboardStaffShiftOpen } from '@/lib/dashboardStaffShiftOpenService';

describe('dashboardStaffShiftOpenHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delegates through manager/staff context and returns success response', async () => {
    (withManagerAndStaffContext as jest.Mock).mockImplementation(
      async (_req, _context, _options, handler) =>
        handler({
          supabase: { from: jest.fn() },
          admin: { from: jest.fn() },
          bizId: 'biz-1',
          staffId: 'staff-1',
          staff: { id: 'staff-1', biz_id: 'biz-1', branch_id: 'branch-1' },
        }),
    );
    (runDashboardStaffShiftOpen as jest.Mock).mockResolvedValue({
      ok: true,
      shift: { id: 'shift-1' },
    });

    const response = await runDashboardStaffShiftOpenHttp(
      new Request('http://localhost/api/dashboard/staff/staff-1/shift/open', {
        method: 'POST',
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(runDashboardStaffShiftOpen).toHaveBeenCalledWith({
      req: expect.any(Request),
      supabase: { from: expect.any(Function) },
      admin: { from: expect.any(Function) },
      bizId: 'biz-1',
      staffId: 'staff-1',
      staff: { id: 'staff-1', biz_id: 'biz-1', branch_id: 'branch-1' },
    });
    expect(response.status).toBe(200);
    expect(body.data.shift).toEqual({ id: 'shift-1' });
  });

  test('maps service errors to api response', async () => {
    (withManagerAndStaffContext as jest.Mock).mockImplementation(
      async (_req, _context, _options, handler) =>
        handler({
          supabase: { from: jest.fn() },
          admin: { from: jest.fn() },
          bizId: 'biz-1',
          staffId: 'staff-1',
          staff: { id: 'staff-1', biz_id: 'biz-1', branch_id: null },
        }),
    );
    (runDashboardStaffShiftOpen as jest.Mock).mockResolvedValue({
      ok: false,
      statusCode: 400,
      errorType: 'validation',
      message: 'bad request',
      details: { code: 'no_branch' },
    });

    const response = await runDashboardStaffShiftOpenHttp(
      new Request('http://localhost/api/dashboard/staff/staff-1/shift/open', {
        method: 'POST',
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
