import { GET } from '@/app/api/cron/health-check-alerts/route';
import { createMockRequest, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/healthCheckAlertsCronHttpService', () => ({
  runHealthCheckAlertsCronHttp: jest.fn(),
}));

import { runHealthCheckAlertsCronHttp } from '@/lib/healthCheckAlertsCronHttpService';

describe('/api/cron/health-check-alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns delegated success response', async () => {
    (runHealthCheckAlertsCronHttp as jest.Mock).mockResolvedValue(
      Response.json({ ok: true, data: { alertSent: false } }),
    );

    const res = await GET(
      createMockRequest('http://localhost/api/cron/health-check-alerts', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    const data = await expectSuccessResponse(res, 200);

    expect(data.alertSent).toBe(false);
  });

  test('returns delegated auth error', async () => {
    (runHealthCheckAlertsCronHttp as jest.Mock).mockResolvedValue(
      Response.json({ ok: false, error: 'auth' }, { status: 401 }),
    );

    const res = await GET(createMockRequest('http://localhost/api/cron/health-check-alerts', { method: 'GET' }));
    await expectErrorResponse(res, 401, 'auth');
  });
});
