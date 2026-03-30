import { runDashboardStaffShiftCloseHttp } from '@/lib/dashboardStaffShiftCloseHttpService';

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/dashboardStaffShiftCloseService', () => ({
  runDashboardStaffShiftClose: jest.fn(),
}));

import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';

describe('dashboardStaffShiftCloseHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-1');
  });

  test('delegates through manager context and returns success response', async () => {
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) =>
      handler({
        admin: { from: jest.fn(), auth: { admin: { getUserById: jest.fn() } } },
        bizId: 'biz-1',
      }),
    );
    (runDashboardStaffShiftClose as jest.Mock).mockResolvedValue({
      ok: true,
      shift: { id: 'shift-1' },
    });

    const response = await runDashboardStaffShiftCloseHttp(
      new Request('http://localhost/api/dashboard/staff/staff-1/shift/close', {
        method: 'POST',
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(runDashboardStaffShiftClose).toHaveBeenCalledWith({
      req: expect.any(Request),
      admin: expect.objectContaining({ from: expect.any(Function) }),
      bizId: 'biz-1',
      staffId: 'staff-1',
    });
    expect(response.status).toBe(200);
    expect(body.data.shift).toEqual({ id: 'shift-1' });
  });

  test('maps service errors to api response', async () => {
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) =>
      handler({
        admin: { from: jest.fn(), auth: { admin: { getUserById: jest.fn() } } },
        bizId: 'biz-1',
      }),
    );
    (runDashboardStaffShiftClose as jest.Mock).mockResolvedValue({
      ok: false,
      statusCode: 400,
      errorType: 'validation',
      message: 'bad request',
    });

    const response = await runDashboardStaffShiftCloseHttp(
      new Request('http://localhost/api/dashboard/staff/staff-1/shift/close', {
        method: 'POST',
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
