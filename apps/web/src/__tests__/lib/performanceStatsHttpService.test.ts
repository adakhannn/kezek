jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/performanceStatsService', () => ({
  getPerformanceStatsSnapshot: jest.fn(),
}));

import { getPerformanceStatsSnapshot } from '@/lib/performanceStatsService';
import { runPerformanceStatsHttp } from '@/lib/performanceStatsHttpService';
import { getServiceClient } from '@/lib/supabaseService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('performanceStatsHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServiceClient as jest.Mock).mockReturnValue({ auth: { getUser: jest.fn() }, from: jest.fn() });
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ caller: 'request-cookie-context' });
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

    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(getPerformanceStatsSnapshot).toHaveBeenCalledWith({ caller: 'request-cookie-context' });
    expect(getServiceClient).not.toHaveBeenCalled();
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

  test('preserves forbidden response for an authenticated non-super-admin', async () => {
    (getPerformanceStatsSnapshot as jest.Mock).mockResolvedValue({
      ok: false, error: 'forbidden', message: 'Access denied', status: 403,
    });
    const response = await runPerformanceStatsHttp();
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('forbidden');
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  test('does not fall back to privileged client when request context fails', async () => {
    (createSupabaseServerClient as jest.Mock).mockRejectedValue(new Error('context unavailable'));
    await expect(runPerformanceStatsHttp()).rejects.toThrow('context unavailable');
    expect(getPerformanceStatsSnapshot).not.toHaveBeenCalled();
    expect(getServiceClient).not.toHaveBeenCalled();
  });
});
