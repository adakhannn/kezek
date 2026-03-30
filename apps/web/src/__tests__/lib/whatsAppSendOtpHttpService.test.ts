import { runWhatsAppSendOtpHttp } from '@/lib/whatsAppSendOtpHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppSendOtpRouteService', () => ({
  runWhatsAppSendOtpRoute: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runWhatsAppSendOtpRoute } from '@/lib/whatsAppSendOtpRouteService';

describe('whatsAppSendOtpHttpService', () => {
  const mockSupabase = { auth: { getUser: jest.fn(), updateUser: jest.fn() }, from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  test('delegates to route service with server client', async () => {
    (runWhatsAppSendOtpRoute as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: 'sent' },
    });

    const response = await runWhatsAppSendOtpHttp();
    const body = await response.json();

    expect(runWhatsAppSendOtpRoute).toHaveBeenCalledWith({
      supabase: mockSupabase,
    });
    expect(response.status).toBe(200);
    expect(body.data.message).toBe('sent');
  });

  test('maps route-service errors to api response', async () => {
    (runWhatsAppSendOtpRoute as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'validation',
      message: 'no phone',
      status: 400,
      details: { code: 'no_phone' },
    });

    const response = await runWhatsAppSendOtpHttp();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
