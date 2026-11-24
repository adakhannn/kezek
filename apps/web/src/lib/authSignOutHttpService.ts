import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  clearSupabaseAuthCookies,
  invalidateUserRefreshTokens,
} from '@/lib/authSignOutService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

export async function runAuthSignOutHttp(): Promise<NextResponse> {
  const { supabase, admin } = await createSupabaseClients();

  await invalidateUserRefreshTokens({
    userClient: supabase,
    admin,
  });

  const response = createSuccessResponse(undefined, { message: 'Выход выполнен' });
  return clearSupabaseAuthCookies(response);
}
