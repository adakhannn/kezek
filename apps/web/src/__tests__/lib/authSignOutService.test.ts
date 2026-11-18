import {
  clearSupabaseAuthCookies,
  invalidateUserRefreshTokens,
  type SignOutAdminLike,
  type SignOutUserClientLike,
} from '@/lib/authSignOutService';

describe('authSignOutService', () => {
  test('invalidates refresh tokens for authenticated user', async () => {
    const userClient: jest.Mocked<SignOutUserClientLike> = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-id' } },
        }),
      },
    };
    const admin: jest.Mocked<SignOutAdminLike> = {
      auth: {
        admin: {
          invalidateRefreshTokens: jest.fn().mockResolvedValue(undefined),
        },
      },
    };

    const result = await invalidateUserRefreshTokens({ userClient, admin });

    expect(result).toEqual({ userId: 'user-id' });
    expect(admin.auth.admin.invalidateRefreshTokens).toHaveBeenCalledWith('user-id');
  });

  test('skips invalidation for anonymous user', async () => {
    const userClient: jest.Mocked<SignOutUserClientLike> = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    };
    const admin: jest.Mocked<SignOutAdminLike> = {
      auth: {
        admin: {},
      },
    };

    const result = await invalidateUserRefreshTokens({ userClient, admin });

    expect(result).toEqual({ userId: null });
  });

  test('clears supabase auth cookies', () => {
    const response = {
      cookies: {
        delete: jest.fn(),
        set: jest.fn(),
      },
    } as unknown as Response & {
      cookies: {
        delete: jest.Mock;
        set: jest.Mock;
      };
    };

    clearSupabaseAuthCookies(response);

    expect(response.cookies.delete).toHaveBeenCalledTimes(2);
    // Two expired variants per auth cookie, plus the chosen staff card (ARCH-02).
    expect(response.cookies.set).toHaveBeenCalledTimes(5);
    expect(response.cookies.set).toHaveBeenCalledWith('kezek_staff_id', '', { expires: new Date(0), path: '/' });
  });
});
