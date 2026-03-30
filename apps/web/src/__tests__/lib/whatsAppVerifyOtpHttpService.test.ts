import { runWhatsAppVerifyOtpHttp } from '@/lib/whatsAppVerifyOtpHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppVerifyOtpRouteService', () => ({
  runWhatsAppVerifyOtpRoute: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runWhatsAppVerifyOtpRoute } from '@/lib/whatsAppVerifyOtpRouteService';

describe('whatsAppVerifyOtpHttpService', () => {
  const mockSupabase = { auth: { getUser: jest.fn() }, from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  test('returns validation error for invalid json', async () => {
    const response = await runWhatsAppVerifyOtpHttp(
      new Request('http://localhost/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates parsed code to route service', async () => {
    (runWhatsAppVerifyOtpRoute as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: 'verified' },
    });

    const response = await runWhatsAppVerifyOtpHttp(
      new Request('http://localhost/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      }),
    );
    const body = await response.json();

    expect(runWhatsAppVerifyOtpRoute).toHaveBeenCalledWith({
      supabase: mockSupabase,
      code: '123456',
    });
    expect(response.status).toBe(200);
    expect(body.data.message).toBe('verified');
  });
});
