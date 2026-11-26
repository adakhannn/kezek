import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

export async function runMeVisitPackagesHttp(req: Request): Promise<NextResponse> {
  // The web session cookie or the app's Bearer token (C10).
  const supabase = await createRequestSupabaseClient(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

  const admin = createSupabaseAdminClient();
  const status = new URL(req.url).searchParams.get('status');
  const result = await listCurrentUserVisitPackages({
    admin,
    user,
    includeAll: status === 'all',
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}

