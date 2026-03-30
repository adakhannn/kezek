jest.mock('@/lib/alerts', () => ({
  sendAlertEmail: jest.fn(),
}));

jest.mock('@/lib/healthCheckAlertsCronService', () => ({
  runHealthCheckAlerts: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logDebug: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';
import { getServiceClient } from '@/lib/supabaseService';

describe('healthCheckAlertsCronHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('returns auth error for invalid secret', async () => {
    const { runHealthCheckAlertsCronHttp } = await import('@/lib/healthCheckAlertsCronHttpService');

    const response = await runHealthCheckAlertsCronHttp(
      new Request('http://localhost/api/cron/health-check-alerts'),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
  });

  test('delegates to health-check cron service for authorized request', async () => {
    (runHealthCheckAlerts as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        healthCheck: { ok: true, alerts: [], checks: {} },
        alertSent: false,
      },
    });
    const { runHealthCheckAlertsCronHttp } = await import('@/lib/healthCheckAlertsCronHttpService');

    const response = await runHealthCheckAlertsCronHttp(
      new Request('http://localhost/api/cron/health-check-alerts', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    const body = await response.json();

    expect(runHealthCheckAlerts).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.data.alertSent).toBe(false);
  });
});
