
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { runStaffDeleteService } from '@/lib/staffDeleteService';
import type { StaffDeleteAdminClientLike, StaffDeleteRoleClientLike } from '@/lib/staffDeleteService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffDeleteHttp(context: unknown): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();

  if (explicitSchedulingEnabled()) {
    return createErrorResponse('conflict', 'Удаление сотрудника с историей работы недоступно. Отключите его активность в карточке сотрудника: график и записи сохранятся.', undefined, 409);
  }

  const result = await runStaffDeleteService({
    admin: getServiceClient() as unknown as StaffDeleteAdminClientLike,
    roleClient: createSupabaseAdminClient() as unknown as StaffDeleteRoleClientLike,
    bizId,
    staffId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
