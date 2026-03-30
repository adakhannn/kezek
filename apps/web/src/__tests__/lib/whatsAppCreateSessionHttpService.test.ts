import { NextResponse } from 'next/server';

import { runWhatsAppCreateSessionHttp } from '@/lib/whatsAppCreateSessionHttpService';

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/whatsAppCreateSessionRouteService', () => ({
  runWhatsAppCreateSessionRoute: jest.fn(),
}));

import { validateRequest } from '@/lib/validation/apiValidation';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppCreateSessionRoute } from '@/lib/whatsAppCreateSessionRouteService';

describe('whatsAppCreateSessionHttpService', () => {
  const mockAdmin = { auth: { admin: {} } };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
  });

  test('returns validation response as-is', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'validation' }, { status: 400 }),
    });

    const response = await runWhatsAppCreateSessionHttp(
      new Request('http://localhost/api/auth/whatsapp/create-session', { method: 'POST' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates valid request to create-session route service', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { phone: '+996555123456', userId: 'user-1' },
    });
    (runWhatsAppCreateSessionRoute as jest.Mock).mockResolvedValue({
      ok: true,
      payload: {
        email: 'u@example.com',
        password: 'temp-pass',
        needsSignIn: true,
      },
    });

    const response = await runWhatsAppCreateSessionHttp(
      new Request('http://localhost/api/auth/whatsapp/create-session', { method: 'POST' }),
    );
    const body = await response.json();

    expect(runWhatsAppCreateSessionRoute).toHaveBeenCalledWith({
      admin: mockAdmin,
      phone: '+996555123456',
      userId: 'user-1',
    });
    expect(response.status).toBe(200);
    expect(body.data.needsSignIn).toBe(true);
  });
});
