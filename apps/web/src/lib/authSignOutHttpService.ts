import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  clearSupabaseAuthCookies,
  invalidateUserRefreshTokens,
  type SignOutAdminLike,
  type SignOutUserClientLike,
} from '@/lib/authSignOutService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

export async function runAuthSignOutHttp(): Promise<NextResponse> {
  const { supabase, admin } = await createSupabaseClients();

  await invalidateUserRefreshTokens({
    userClient: supabase as unknown as SignOutUserClientLike,
    admin: admin as unknown as SignOutAdminLike,
  });

  const response = createSuccessResponse(undefined, { message: 'Выход выполнен' });
  return clearSupabaseAuthCookies(response);
}
