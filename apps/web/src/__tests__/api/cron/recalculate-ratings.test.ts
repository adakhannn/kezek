import { GET } from '@/app/api/cron/recalculate-ratings/route';
import { createMockRequest, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/recalculateRatingsCronHttpService', () => ({
  runRecalculateRatingsCronHttp: jest.fn(),
}));

import { runRecalculateRatingsCronHttp } from '@/lib/recalculateRatingsCronHttpService';

describe('/api/cron/recalculate-ratings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns delegated success response', async () => {
    (runRecalculateRatingsCronHttp as jest.Mock).mockResolvedValue(
      Response.json({ ok: true, data: { message: 'ok' } }),
    );

    const res = await GET(
      createMockRequest('http://localhost/api/cron/recalculate-ratings', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    const data = await expectSuccessResponse(res, 200);

    expect(data.message).toBe('ok');
  });

  test('returns delegated auth error', async () => {
    (runRecalculateRatingsCronHttp as jest.Mock).mockResolvedValue(
      Response.json({ ok: false, error: 'auth' }, { status: 401 }),
    );

    const res = await GET(createMockRequest('http://localhost/api/cron/recalculate-ratings', { method: 'GET' }));
    await expectErrorResponse(res, 401, 'auth');
  });
});
