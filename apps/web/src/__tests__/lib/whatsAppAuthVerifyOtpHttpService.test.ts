import { NextResponse } from 'next/server';

import { runWhatsAppAuthVerifyOtpHttp } from '@/lib/whatsAppAuthVerifyOtpHttpService';

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppAuthVerifyOtpRouteService', () => ({
  runWhatsAppAuthVerifyOtpRoute: jest.fn(),
}));

import { validateRequest } from '@/lib/validation/apiValidation';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppAuthVerifyOtpRoute } from '@/lib/whatsAppAuthVerifyOtpRouteService';

describe('whatsAppAuthVerifyOtpHttpService', () => {
  const mockAdmin = { auth: { admin: {} }, from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
  });

  test('returns validation response as-is', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'validation' }, { status: 400 }),
    });

    const response = await runWhatsAppAuthVerifyOtpHttp(
      new Request('http://localhost/api/auth/whatsapp/verify-otp', { method: 'POST' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates valid request to route service', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { phone: '+996555123456', code: '123456' },
    });
    (runWhatsAppAuthVerifyOtpRoute as jest.Mock).mockResolvedValue({
      ok: true,
      payload: {
        message: 'ok',
        userId: 'user-1',
        phone: '+996555123456',
        isNewUser: false,
      },
    });

    const response = await runWhatsAppAuthVerifyOtpHttp(
      new Request('http://localhost/api/auth/whatsapp/verify-otp', { method: 'POST' }),
    );
    const body = await response.json();

    expect(runWhatsAppAuthVerifyOtpRoute).toHaveBeenCalledWith({
      admin: mockAdmin,
      phone: '+996555123456',
      code: '123456',
    });
    expect(response.status).toBe(200);
    expect(body.data.userId).toBe('user-1');
  });
});
