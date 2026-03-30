import { runFrontendMetricsHttp } from '@/lib/frontendMetricsHttpService';

jest.mock('@/lib/apiMetrics', () => ({
  getIpAddress: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/frontendMetricsService', () => ({
  getFrontendMetricType: jest.fn().mockReturnValue('render'),
  saveFrontendMetric: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

import { saveFrontendMetric } from '@/lib/frontendMetricsService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

describe('frontendMetricsHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn() } });
    (getServiceClient as jest.Mock).mockReturnValue({ rpc: jest.fn() });
  });

  test('returns validation error for invalid json body', async () => {
    const req = new Request('http://localhost/api/metrics/frontend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    const response = await runFrontendMetricsHttp(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
    expect(saveFrontendMetric).not.toHaveBeenCalled();
  });

  test('saves metric asynchronously and returns success', async () => {
    const req = new Request('http://localhost/api/metrics/frontend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        page: '/dashboard',
        renderTime: 500,
        componentCount: 25,
        timestamp: Date.now(),
      }),
    });

    const response = await runFrontendMetricsHttp(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ ok: true });
    expect(saveFrontendMetric).toHaveBeenCalled();
  });
});
