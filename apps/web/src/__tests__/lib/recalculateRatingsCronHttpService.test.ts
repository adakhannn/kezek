jest.mock('@/lib/alerts', () => ({
  sendAlertEmail: jest.fn(),
}));

jest.mock('@/lib/performance', () => ({
  measurePerformance: jest.fn(),
}));

jest.mock('@/lib/recalculateRatingsCronService', () => ({
  runRecalculateRatingsCron: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
  getTimezone: jest.fn(() => 'Asia/Almaty'),
  todayDateString: jest.fn(() => '2026-03-28'),
}));

import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';
import { getServiceClient } from '@/lib/supabaseService';

describe('recalculateRatingsCronHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(), rpc: jest.fn() });
  });

  test('returns auth error for invalid secret', async () => {
    const { runRecalculateRatingsCronHttp } = await import('@/lib/recalculateRatingsCronHttpService');

    const response = await runRecalculateRatingsCronHttp(
      new Request('http://localhost/api/cron/recalculate-ratings'),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
  });

  test('delegates to recalculate cron service for authorized request', async () => {
    (runRecalculateRatingsCron as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: 'ok' },
    });
    const { runRecalculateRatingsCronHttp } = await import('@/lib/recalculateRatingsCronHttpService');

    const response = await runRecalculateRatingsCronHttp(
      new Request('http://localhost/api/cron/recalculate-ratings', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    const body = await response.json();

    expect(runRecalculateRatingsCron).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.data.message).toBe('ok');
  });
});
