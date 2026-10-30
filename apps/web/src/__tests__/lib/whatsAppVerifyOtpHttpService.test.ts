import { runWhatsAppVerifyOtpHttp } from '@/lib/whatsAppVerifyOtpHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppIdentityOwnershipService', () => ({
  findWhatsAppOwnerByPhone: jest.fn(),
}));

jest.mock('@/lib/whatsAppVerifyOtpRouteService', () => ({
  runWhatsAppVerifyOtpRoute: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { findWhatsAppOwnerByPhone } from '@/lib/whatsAppIdentityOwnershipService';
import { runWhatsAppVerifyOtpRoute } from '@/lib/whatsAppVerifyOtpRouteService';

describe('whatsAppVerifyOtpHttpService', () => {
  const mockSupabase = { auth: { getUser: jest.fn() }, from: jest.fn() };
  const mockAdmin = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
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
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(runWhatsAppVerifyOtpRoute).not.toHaveBeenCalled();
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
      findAuthOwnerByPhone: expect.any(Function),
    });
    (findWhatsAppOwnerByPhone as jest.Mock).mockResolvedValue('existing-owner');
    const { findAuthOwnerByPhone } = (runWhatsAppVerifyOtpRoute as jest.Mock).mock.calls[0][0];
    await expect(findAuthOwnerByPhone('+996555123456')).resolves.toBe('existing-owner');
    expect(findWhatsAppOwnerByPhone).toHaveBeenCalledWith(mockAdmin, '+996555123456');
    expect(response.status).toBe(200);
    expect(body.data.message).toBe('verified');
  });
});
