jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/performanceStatsService', () => ({
  getPerformanceStatsSnapshot: jest.fn(),
}));

import { getPerformanceStatsSnapshot } from '@/lib/performanceStatsService';
import { runPerformanceStatsHttp } from '@/lib/performanceStatsHttpService';
import { getServiceClient } from '@/lib/supabaseService';

describe('performanceStatsHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServiceClient as jest.Mock).mockReturnValue({ auth: { getUser: jest.fn() }, from: jest.fn() });
  });

  test('delegates success result to api response', async () => {
    (getPerformanceStatsSnapshot as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        stats: [{ operation: 'op-1', count: 1 }],
        timestamp: 123,
      },
    });

    const response = await runPerformanceStatsHttp();
    const body = await response.json();

    expect(getPerformanceStatsSnapshot).toHaveBeenCalledWith(expect.any(Object));
    expect(response.status).toBe(200);
    expect(body.data.stats).toHaveLength(1);
  });

  test('maps auth errors to api response', async () => {
    (getPerformanceStatsSnapshot as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'auth',
      message: 'РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ',
      status: 401,
    });

    const response = await runPerformanceStatsHttp();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
  });
});
