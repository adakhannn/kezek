/**
 * Интеграционные тесты для /api/notify/ping
 * Проверяет отправку тестового письма через Resend и обработку ошибок конфигурации
 */

import { POST } from '@/app/api/notify/ping/route';
import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
jest.mock('@/lib/adminHttpAccess', () => ({ requireCurrentSuperAdmin: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ withRateLimit: (_req: Request, _config: unknown, handler: () => Promise<Response>) => handler(), RateLimitConfigs: { critical: {} } }));
import { createMockRequest, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

describe('/api/notify/ping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(requireCurrentSuperAdmin).mockResolvedValue({ ok: true, user: { id: 'admin', email: 'user@example.com', email_confirmed_at: '2026-01-01' } } as never);
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('должен вернуть 503, если настройки отправки отсутствуют', async () => {
    const req = createMockRequest('http://localhost/api/notify/ping', {
      method: 'POST',
      body: { to: 'user@example.com' },
    });

    const res = await POST(req);
    const data = await expectErrorResponse(res, 503, 'service_unavailable');

    expect(data.message).toContain('не настроена');
  });

  test('должен отправить ping-письмо при наличии RESEND_API_KEY', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.EMAIL_FROM = 'noreply@example.com';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: jest.fn().mockResolvedValue('{"id":"email_123"}'),
    });
    // Подменяем глобальный fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    const req = createMockRequest('http://localhost/api/notify/ping', {
      method: 'POST',
      body: { to: 'user@example.com' },
    });

    const res = await POST(req);
    const data = await expectSuccessResponse(res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          Authorization: 'Bearer test-resend-key',
        }),
      }),
    );

    expect(data.ok).toBe(true);
    expect(data.data).toMatchObject({
      ok: true,
      status: 202,
    });
  });
});




