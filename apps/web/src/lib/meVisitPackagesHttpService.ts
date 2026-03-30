import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

const TODAY = new Date().toISOString().slice(0, 10);

export async function runMeVisitPackagesHttp(req: Request): Promise<NextResponse> {
  const { supabase, admin } = await createSupabaseClients();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('auth', 'Р СњР Вµ Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р С•Р Р†Р В°Р Р…', undefined, 401);
  }

  const status = new URL(req.url).searchParams.get('status');
  const result = await listCurrentUserVisitPackages({
    admin: admin as never,
    user,
    includeAll: status === 'all',
    today: TODAY,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
