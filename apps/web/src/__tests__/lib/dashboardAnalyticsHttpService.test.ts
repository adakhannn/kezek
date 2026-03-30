import {
  runDashboardAnalyticsLoadHttp,
  runDashboardAnalyticsOverviewHttp,
} from '@/lib/dashboardAnalyticsHttpService';

jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/dashboardAnalyticsOverviewService', () => ({
  getDashboardAnalyticsOverview: jest.fn(),
}));

jest.mock('@/lib/dashboardAnalyticsLoadService', () => ({
  getDashboardAnalyticsLoad: jest.fn(),
}));

import { withManagerContext } from '@/lib/withManagerContext';
import { getDashboardAnalyticsOverview } from '@/lib/dashboardAnalyticsOverviewService';
import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';

describe('dashboardAnalyticsHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, callback) =>
      callback({ bizId: 'biz-1', admin: { from: jest.fn() } }),
    );
  });

  test('loads overview analytics through manager context', async () => {
    (getDashboardAnalyticsOverview as jest.Mock).mockResolvedValue({
      ok: true,
      data: { summary: {} },
    });

    const response = await runDashboardAnalyticsOverviewHttp(
      new Request('http://localhost/api/dashboard/analytics/overview?startDate=2026-01-01&endDate=2026-01-31'),
    );
    const body = await response.json();

    expect(getDashboardAnalyticsOverview).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
      bizId: 'biz-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ summary: {} });
  });

  test('loads hourly analytics through manager context', async () => {
    (getDashboardAnalyticsLoad as jest.Mock).mockResolvedValue({
      ok: true,
      data: { points: [] },
    });

    const response = await runDashboardAnalyticsLoadHttp(
      new Request('http://localhost/api/dashboard/analytics/load?branchId=550e8400-e29b-41d4-a716-446655440000'),
    );
    const body = await response.json();

    expect(getDashboardAnalyticsLoad).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
      bizId: 'biz-1',
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      startDate: expect.any(String),
      endDate: expect.any(String),
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ points: [] });
  });
});
