import { NextResponse } from 'next/server';

import { runTelegramLinkHttp } from '@/lib/telegramLinkHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

jest.mock('@/lib/telegramLinkService', () => ({
  linkTelegramAccount: jest.fn(),
}));

import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { linkTelegramAccount } from '@/lib/telegramLinkService';

describe('telegramLinkHttpService', () => {
  const mockGetUser = jest.fn();
  const mockAdmin = { from: jest.fn(), auth: { admin: { updateUserById: jest.fn() } } };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: {
        auth: {
          getUser: mockGetUser,
        },
      },
      admin: mockAdmin,
    });
  });

  test('returns auth error when user is missing', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'unauthorized' },
    });

    const response = await runTelegramLinkHttp(
      new Request('http://localhost/api/auth/telegram/link', { method: 'POST' }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
  });

  test('returns validation response as-is', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: {} } },
      error: null,
    });
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'validation' }, { status: 400 }),
    });

    const response = await runTelegramLinkHttp(
      new Request('http://localhost/api/auth/telegram/link', { method: 'POST' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates to linkTelegramAccount on success', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: { locale: 'ru' } } },
      error: null,
    });
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 123, hash: 'ok', auth_date: 1 },
    });
    (linkTelegramAccount as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: 'linked' },
    });

    const response = await runTelegramLinkHttp(
      new Request('http://localhost/api/auth/telegram/link', { method: 'POST' }),
    );
    const body = await response.json();

    expect(linkTelegramAccount).toHaveBeenCalledWith({
      admin: mockAdmin,
      user: {
        id: 'user-1',
        user_metadata: { locale: 'ru' },
      },
      body: { id: 123, hash: 'ok', auth_date: 1 },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ message: 'linked' });
  });
});
