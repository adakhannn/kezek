import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runStaffRestore } from '@/lib/staffRestoreService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffRestoreHttp(context: unknown): Promise<NextResponse> {
  const result = await runStaffRestore({
    admin: getServiceClient() as never,
    roleAdmin: createSupabaseAdminClient() as never,
    bizId: (await getBizContextForManagers()).bizId,
    staffId: await getRouteParamRequired(context, 'id'),
    checkResourceBelongsToBiz: (admin, table, resourceId, bizId, select) =>
      checkResourceBelongsToBiz(admin, table, resourceId, bizId, select) as Promise<{
        data?: { id: string; biz_id: string; user_id: string | null; is_active: boolean } | null;
        error?: unknown;
      }>,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
