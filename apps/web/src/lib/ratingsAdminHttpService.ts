import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { ensureSuperAdminAccess } from '@/lib/ratingsDebugEntitiesService';
import { getRatingsJobs } from '@/lib/ratingsJobsService';
import { getRatingsStatus, type RatingsStatusAdminQueryLike } from '@/lib/ratingsStatusService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runRatingsStatusHttp(req: Request): Promise<NextResponse> {
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

  const errorsWindowDaysParam = new URL(req.url).searchParams.get('errors_days');
  const data = await getRatingsStatus(
    getServiceClient() as unknown as RatingsStatusAdminQueryLike,
    { errorsWindowDaysParam },
  );

  return createSuccessResponse(data);
}

export async function runRatingsJobsHttp(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

  const accessResult = await ensureSuperAdminAccess({
    supabase: supabase as never,
  });
  if (!accessResult.ok) {
    return createErrorResponse(accessResult.error, accessResult.message, undefined, accessResult.status);
  }

  const result = await getRatingsJobs({
    admin: getServiceClient() as never,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}

