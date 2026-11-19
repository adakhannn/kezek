import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
  target_branch_id?: string;
  expected_branch_id?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RPC_ERRORS: Record<string, { message: string; status: number }> = {
  SCHEDULE_STALE: { message: 'Основной филиал уже изменён. Обновите карточку сотрудника.', status: 409 },
  SCHEDULE_BOOKING_CONFLICT: { message: 'Перевод конфликтует с записями клиентов. Ничего не изменено.', status: 409 },
  SCHEDULE_FUTURE_ASSIGNMENT: { message: 'У сотрудника уже запланирован перевод. Сначала проверьте его назначения.', status: 409 },
  SCHEDULE_FORBIDDEN: { message: 'Недостаточно прав для перевода.', status: 403 },
  SCHEDULE_INVALID_BRANCH: { message: 'Целевой филиал недоступен.', status: 400 },
  SCHEDULE_NOT_FOUND: { message: 'Сотрудник не найден или неактивен.', status: 404 },
  SCHEDULE_SAME_BRANCH: { message: 'Сотрудник уже находится в этом филиале.', status: 400 },
};

/**
 * Moves a staff member to another home branch with one atomic command (ARCH-07). transfer_staff_home
 * locks the branch and the staff row, checks the expected current branch, rewrites the assignments,
 * records the change and refuses a transfer that would leave future bookings outside the schedule, in
 * one transaction. The old step-by-step path closed the current assignment and inserted the new one
 * before it changed staff.branch_id, which the database allows only inside that command
 * (guard_staff_home_change), so it failed after its first writes and left the assignments moved.
 */
export async function runStaffTransferHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const staffId = await getRouteParamRequired(context, 'id');
  const { bizId, userId } = await getBizContextForManagers();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (error) {
    logError('StaffTransfer', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  if (!body || !UUID.test(staffId) || !UUID.test(body.target_branch_id || '') || !UUID.test(body.expected_branch_id || '')) {
    return createErrorResponse('validation', 'Обновите карточку и выберите филиал для перевода.', undefined, 400);
  }

  const { data, error } = await getServiceClient().rpc('transfer_staff_home', {
    p_staff: staffId,
    p_biz: bizId,
    p_actor: userId,
    // Both ids were validated as UUIDs above.
    p_expected_branch: body.expected_branch_id as string,
    p_target: body.target_branch_id as string,
  });
  if (error) {
    const code = Object.keys(RPC_ERRORS).find((key) => error.message.includes(key));
    if (!code) {
      logError('StaffTransfer', 'Atomic transfer failed', error);
      return createErrorResponse('internal', 'Не удалось выполнить перевод. Изменения не применены.', undefined, 500);
    }
    return createErrorResponse(code, RPC_ERRORS[code].message, undefined, RPC_ERRORS[code].status);
  }
  return createSuccessResponse(data);
}
