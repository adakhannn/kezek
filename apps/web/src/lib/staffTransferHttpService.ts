import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { runStaffTransfer } from '@/lib/staffTransferService';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
  target_branch_id: string;
  copy_schedule?: boolean;
  expected_branch_id?: string;
};

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

  if (explicitSchedulingEnabled()) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!body || !uuid.test(staffId) || !uuid.test(body.target_branch_id || '') || !uuid.test(body.expected_branch_id || '')) {
      return createErrorResponse('validation', 'Обновите карточку и выберите филиал для перевода.', undefined, 400);
    }
    const { data, error } = await getServiceClient().rpc('transfer_staff_home', {
      p_staff: staffId, p_biz: bizId, p_actor: userId,
      p_expected_branch: body.expected_branch_id, p_target: body.target_branch_id,
    });
    if (error) {
      const messages: Record<string, string> = {
        SCHEDULE_STALE: 'Основной филиал уже изменён. Обновите карточку сотрудника.',
        SCHEDULE_BOOKING_CONFLICT: 'Перевод конфликтует с записями клиентов. Ничего не изменено.',
        SCHEDULE_FUTURE_ASSIGNMENT: 'У сотрудника уже запланирован перевод. Сначала проверьте его назначения.',
        SCHEDULE_FORBIDDEN: 'Недостаточно прав для перевода.',
        SCHEDULE_INVALID_BRANCH: 'Целевой филиал недоступен.',
        SCHEDULE_NOT_FOUND: 'Сотрудник не найден или неактивен.',
        SCHEDULE_SAME_BRANCH: 'Сотрудник уже находится в этом филиале.',
      };
      const code = Object.keys(messages).find(key => error.message.includes(key));
      if (!code) logError('StaffTransfer', 'Atomic transfer failed', error);
      return createErrorResponse(code || 'internal', code ? messages[code] : 'Не удалось выполнить перевод. Изменения не применены.', undefined,
        code === 'SCHEDULE_FORBIDDEN' ? 403 : code === 'SCHEDULE_NOT_FOUND' ? 404 : code && ['SCHEDULE_STALE','SCHEDULE_BOOKING_CONFLICT','SCHEDULE_FUTURE_ASSIGNMENT'].includes(code) ? 409 : code ? 400 : 500);
    }
    return createSuccessResponse(data);
  }

  const result = await runStaffTransfer({
    admin: getServiceClient(),
    bizId,
    staffId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
