jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/authSignOutService', () => ({
  invalidateUserRefreshTokens: jest.fn(),
  clearSupabaseAuthCookies: jest.fn((response) => response),
}));

import { invalidateUserRefreshTokens, clearSupabaseAuthCookies } from '@/lib/authSignOutService';
import { runAuthSignOutHttp } from '@/lib/authSignOutHttpService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

describe('authSignOutHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: { auth: { getUser: jest.fn() } },
      admin: { auth: { admin: { invalidateRefreshTokens: jest.fn() } } },
    });
  });

  test('delegates sign-out flow and clears cookies', async () => {
    const response = await runAuthSignOutHttp();
    const body = await response.json();

    expect(invalidateUserRefreshTokens).toHaveBeenCalledWith({
      userClient: expect.any(Object),
      admin: expect.any(Object),
    });
    expect(clearSupabaseAuthCookies).toHaveBeenCalled();
    expect(body.message).toBe('Выход выполнен');
  });
});
