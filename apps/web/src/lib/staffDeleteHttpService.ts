import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffDeleteService } from '@/lib/staffDeleteService';
import type { StaffDeleteAdminClientLike, StaffDeleteRoleClientLike } from '@/lib/staffDeleteService';

export async function runStaffDeleteHttp(context: unknown): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();

  const result = await runStaffDeleteService({
    admin: getServiceClient() as unknown as StaffDeleteAdminClientLike,
    roleClient: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    ) as unknown as StaffDeleteRoleClientLike,
    bizId,
    staffId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
