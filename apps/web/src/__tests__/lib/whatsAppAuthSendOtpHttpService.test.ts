import { runWhatsAppAuthSendOtpHttp } from '@/lib/whatsAppAuthSendOtpHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppAuthSendOtpRouteService', () => ({
  runWhatsAppAuthSendOtpRoute: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppAuthSendOtpRoute } from '@/lib/whatsAppAuthSendOtpRouteService';

describe('whatsAppAuthSendOtpHttpService', () => {
  const mockAdmin = { auth: { admin: {} }, from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
  });

  test('returns validation error for invalid json', async () => {
    const response = await runWhatsAppAuthSendOtpHttp(
      new Request('http://localhost/api/auth/whatsapp/send-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates parsed phone to route service', async () => {
    (runWhatsAppAuthSendOtpRoute as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: 'sent' },
    });

    const response = await runWhatsAppAuthSendOtpHttp(
      new Request('http://localhost/api/auth/whatsapp/send-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '+996555123456' }),
      }),
    );
    const body = await response.json();

    expect(runWhatsAppAuthSendOtpRoute).toHaveBeenCalledWith({
      admin: mockAdmin,
      phone: '+996555123456',
    });
    expect(response.status).toBe(200);
    expect(body.data.message).toBe('sent');
  });
});
