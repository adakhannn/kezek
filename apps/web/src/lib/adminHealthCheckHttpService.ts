import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runAdminHealthCheck } from '@/lib/adminHealthCheckService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runAdminHealthCheckHttp(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

  const { data: superRow, error: superErr } = await supabase
    .from('user_roles_with_user')
    .select('role_key,biz_id')
    .eq('role_key', 'super_admin')
    .is('biz_id', null)
    .limit(1)
    .maybeSingle();

  if (superErr) {
    return createErrorResponse('internal', superErr.message, undefined, 400);
  }

  if (!superRow) {
    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
  }

  const result = await runAdminHealthCheck({ admin: getServiceClient() });
  if (!result.ok) {
    return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
  }

  return createSuccessResponse(result.data);
}
