import {
  exchangeWhatsAppWebSession,
  mapStartError,
  startWhatsAppWebAuth,
  verifyWhatsAppWebOtp,
} from '@/app/auth/whatsapp/whatsAppWebAuthClient';

function mockResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('whatsAppWebAuthClient', () => {
  test('start -> verify -> exchange happy path works', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, {
          ok: true,
          data: {
            attemptId: 'attempt-1',
            maskedDestination: '+********4029',
            expiresAt: '2026-05-20T10:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(200, {
          ok: true,
          data: {
            status: 'approved',
            attemptId: 'attempt-1',
            exchangeCode: 'ABC123',
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(200, {
          ok: true,
          data: {
            accessToken: 'at-1',
            refreshToken: 'rt-1',
          },
        }),
      );

    const start = await startWhatsAppWebAuth(fetcher as unknown as typeof fetch, '+996500574029');
    expect(start.attemptId).toBe('attempt-1');

    const verify = await verifyWhatsAppWebOtp(fetcher as unknown as typeof fetch, {
      attemptId: start.attemptId,
      phone: '+996500574029',
      code: '123456',
    });
    expect(verify.status).toBe('approved');
    expect(verify.exchangeCode).toBe('ABC123');

    const exchange = await exchangeWhatsAppWebSession(
      fetcher as unknown as typeof fetch,
      verify.exchangeCode!,
    );
    expect(exchange).toEqual({ accessToken: 'at-1', refreshToken: 'rt-1' });
  });

  test('maps 503 service_unavailable to user-friendly start message', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      mockResponse(503, {
        ok: false,
        error: 'service_unavailable',
        message: 'WhatsApp mobile auth is disabled by feature flag/rollout',
      }),
    );

    await expect(
      startWhatsAppWebAuth(fetcher as unknown as typeof fetch, '+996500574029'),
    ).rejects.toThrow(
      'Вход через WhatsApp временно недоступен для вашего профиля. Попробуйте позже.',
    );
  });

  test('start error mapper keeps fallback behavior for unknown statuses', () => {
    const message = mapStartError(400, { message: 'validation failed' });
    expect(message).toBe('validation failed');
  });
});
