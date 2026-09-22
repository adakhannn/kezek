import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
  getBranchSchedule,
  saveBranchSchedule,
  type BranchScheduleAdminLike,
  type BranchScheduleBody,
} from '@/lib/branchScheduleService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { getServiceClient } from '@/lib/supabaseService';

export async function runGetBranchScheduleHttp(
  _req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();

  const result = await getBranchSchedule({
    admin: getServiceClient() as unknown as BranchScheduleAdminLike,
    branchId,
    bizId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}

export async function runSaveBranchScheduleHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamUuid(context, 'id');
  const { bizId, userId } = await getBizContextForManagers();
  const body = (await req.json()) as BranchScheduleBody;

  if (explicitSchedulingEnabled()) {
    const { error } = await getServiceClient().rpc('replace_branch_schedule', {
      p_biz: bizId, p_branch: branchId, p_actor: userId, p_days: body.schedule,
    });
    if (error) return createErrorResponse('validation',
      error.message.includes('SCHEDULE_BOOKING_CONFLICT')
        ? 'Новые часы конфликтуют с записями клиентов. Изменение не применено.'
        : 'Не удалось сохранить график. Проверьте все семь дней, интервалы и перерывы.', undefined,
      error.message.includes('SCHEDULE_BOOKING_CONFLICT') ? 409 : 400);
    return createSuccessResponse();
  }

  const result = await saveBranchSchedule({
    admin: getServiceClient() as unknown as BranchScheduleAdminLike,
    branchId,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
