import { NextRequest } from 'next/server';

import {
  runMobileExchangeGetHttp,
  runMobileExchangePostHttp,
} from '@/lib/mobileExchangeHttpService';

jest.mock('@/lib/mobileExchangeRouteService', () => ({
  runMobileExchangeGet: jest.fn(),
  runMobileExchangePost: jest.fn(),
}));

import {
  runMobileExchangeGet,
  runMobileExchangePost,
} from '@/lib/mobileExchangeRouteService';

describe('mobileExchangeHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delegates POST body to route service', async () => {
    (runMobileExchangePost as jest.Mock).mockReturnValue({
      ok: true,
      payload: { code: 'abc123' },
    });

    const response = await runMobileExchangePostHttp(
      new NextRequest('http://localhost/api/auth/mobile-exchange', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      }),
    );
    const body = await response.json();

    expect(runMobileExchangePost).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ code: 'abc123' });
  });

  test('maps GET search params to route service', async () => {
    (runMobileExchangeGet as jest.Mock).mockReturnValue({
      ok: true,
      payload: { hasPending: true, code: 'xyz', createdAt: 123 },
    });

    const response = await runMobileExchangeGetHttp(
      new NextRequest('http://localhost/api/auth/mobile-exchange?check=true'),
    );
    const body = await response.json();

    expect(runMobileExchangeGet).toHaveBeenCalledWith({
      code: null,
      check: true,
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ hasPending: true, code: 'xyz', createdAt: 123 });
  });

  test('returns route-service validation errors', async () => {
    (runMobileExchangeGet as jest.Mock).mockReturnValue({
      ok: false,
      status: 400,
      error: 'validation',
      message: 'bad code',
    });

    const response = await runMobileExchangeGetHttp(
      new NextRequest('http://localhost/api/auth/mobile-exchange'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
