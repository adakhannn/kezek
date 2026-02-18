/**
 * Интеграционные тесты для /api/notify/ping
 * Проверяет отправку тестового письма через Resend и обработку ошибок конфигурации
 */

import { POST } from '@/app/api/notify/ping/route';
import { createMockRequest, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

describe('/api/notify/ping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('должен вернуть 400, если RESEND_API_KEY не установлен', async () => {
    const req = createMockRequest('http://localhost/api/notify/ping', {
      method: 'POST',
      body: { to: 'user@example.com' },
    });

    const res = await POST(req);
    const data = await expectErrorResponse(res, 400, 'validation');

    expect(data.message).toContain('RESEND_API_KEY');
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
      text: '{"id":"email_123"}',
    });
  });
}


