import { getSupabaseUrl } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';

export type SignOutUserClientLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
};

export type SignOutAdminLike = {
  auth: {
    admin: {
      invalidateRefreshTokens?: (userId: string) => Promise<unknown>;
    };
  };
};

export async function invalidateUserRefreshTokens(params: {
  userClient: SignOutUserClientLike;
  admin: SignOutAdminLike;
}) {
  const {
    data: { user },
  } = await params.userClient.auth.getUser();

  if (!user) {
    return { userId: null };
  }

  try {
    const authAdmin = params.admin.auth.admin as {
      invalidateRefreshTokens?: (userId: string) => Promise<unknown>;
    };

    if (authAdmin.invalidateRefreshTokens) {
      await authAdmin.invalidateRefreshTokens(user.id).catch(() => {});
      logDebug('AuthSignOut', 'Invalidated refresh tokens for user', { userId: user.id });
    }
  } catch (err) {
    logError('AuthSignOut', 'Error invalidating tokens', err);
  }

  return { userId: user.id };
}

export function clearSupabaseAuthCookies<T extends {
  cookies: {
    delete: (name: string) => void;
    set: (name: string, value: string, options: Record<string, unknown>) => void;
  };
}>(response: T): T {
  const url = getSupabaseUrl();
  const projectRef = url.split('//')[1].split('.')[0];
  const cookieNames = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
  ];

  cookieNames.forEach((name) => {
    response.cookies.delete(name);
    response.cookies.set(name, '', { expires: new Date(0), path: '/' });
    response.cookies.set(name, '', { expires: new Date(0), path: '/', domain: undefined });
  });

  return response;
}
