import {
  getFrontendMetricType,
  saveFrontendMetric,
  type FrontendMetricsAdminLike,
  type FrontendMetricsUserClientLike,
} from '@/lib/frontendMetricsService';

describe('frontendMetricsService', () => {
  test('detects web vitals metric type', () => {
    expect(
      getFrontendMetricType({
        name: 'LCP',
        value: 1200,
        rating: 'good',
        delta: 100,
        id: 'metric-id',
        navigationType: 'navigate',
        url: '/home',
        timestamp: Date.now(),
      }),
    ).toBe('web-vitals');
  });

  test('detects page load metric type', () => {
    expect(
      getFrontendMetricType({
        page: '/dashboard',
        loadTime: 2000,
        domInteractive: 1500,
        domComplete: 1800,
        firstPaint: 1000,
        firstContentfulPaint: 1200,
        timeToFirstByte: 500,
        timestamp: Date.now(),
      }),
    ).toBe('page-load');
  });

  test('saves metric through RPC with user and request context', async () => {
    const admin: jest.Mocked<FrontendMetricsAdminLike> = {
      rpc: jest.fn().mockResolvedValue({ error: null }),
    };
    const userClient: jest.Mocked<FrontendMetricsUserClientLike> = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-id' } },
        }),
      },
    };
    const req = new Request('http://localhost/api/metrics/frontend', {
      method: 'POST',
      headers: { 'user-agent': 'Mozilla/5.0' },
    });

    await saveFrontendMetric(
      {
        page: '/dashboard',
        renderTime: 500,
        componentCount: 25,
        timestamp: 1710000000000,
      },
      {
        req,
        admin,
        userClient,
        ipAddress: '127.0.0.1',
      },
    );

    expect(admin.rpc).toHaveBeenCalledWith(
      'log_frontend_metric',
      expect.objectContaining({
        p_metric_type: 'render',
        p_user_id: 'user-id',
        p_page: '/dashboard',
        p_user_agent: 'Mozilla/5.0',
        p_ip_address: '127.0.0.1',
      }),
    );
  });

  test('swallows RPC errors and keeps request non-blocking', async () => {
    const admin: jest.Mocked<FrontendMetricsAdminLike> = {
      rpc: jest.fn().mockResolvedValue({ error: { message: 'Function not found' } }),
    };
    const userClient: jest.Mocked<FrontendMetricsUserClientLike> = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    };

    await expect(
      saveFrontendMetric(
        {
          name: 'CLS',
          value: 0.1,
          rating: 'good',
          delta: 0.05,
          id: 'metric-id',
          navigationType: 'navigate',
          url: '/test',
          timestamp: Date.now(),
        },
        {
          req: new Request('http://localhost/api/metrics/frontend'),
          admin,
          userClient,
          ipAddress: null,
        },
      ),
    ).resolves.toBeUndefined();
  });
});
