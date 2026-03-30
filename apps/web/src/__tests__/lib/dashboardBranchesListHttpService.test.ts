jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/dashboardBranchesListService', () => ({
  listDashboardBranches: jest.fn(),
}));

import { runDashboardBranchesListHttp } from '@/lib/dashboardBranchesListHttpService';
import { listDashboardBranches } from '@/lib/dashboardBranchesListService';
import { withManagerContext } from '@/lib/withManagerContext';

describe('dashboardBranchesListHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delegates through manager context and returns success response', async () => {
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) =>
      handler({ supabase: { from: jest.fn() }, bizId: 'biz-1' }),
    );
    (listDashboardBranches as jest.Mock).mockResolvedValue({
      ok: true,
      data: [{ id: 'branch-1', name: 'Main' }],
    });

    const response = await runDashboardBranchesListHttp(
      new Request('http://localhost/api/dashboard/branches/list'),
    );
    const body = await response.json();

    expect(listDashboardBranches).toHaveBeenCalledWith({
      supabase: { from: expect.any(Function) },
      bizId: 'biz-1',
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'branch-1', name: 'Main' }]);
  });

  test('maps service errors to api response', async () => {
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) =>
      handler({ supabase: { from: jest.fn() }, bizId: 'biz-1' }),
    );
    (listDashboardBranches as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'server',
      message: 'Failed to load branches',
      details: 'db failed',
      status: 500,
    });

    const response = await runDashboardBranchesListHttp(
      new Request('http://localhost/api/dashboard/branches/list'),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('server');
    expect(body.details).toBe('db failed');
  });
});
