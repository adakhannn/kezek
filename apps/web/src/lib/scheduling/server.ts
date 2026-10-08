import { formatInTimeZone } from 'date-fns-tz';

import { explicitSchedulingEnabled } from './config';
import { validDate, validatePublishSchedule, type ScheduleSnapshot } from './model';

import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/apiErrorHandler';
import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

const messages: Record<string, string> = {
    SCHEDULE_INVALID: 'Проверьте даты, рабочие интервалы и перерывы. Интервалы должны идти по порядку и не пересекаться.',
    SCHEDULE_INVALID_BRANCH: 'Выбранный филиал недоступен.',
    SCHEDULE_OUTSIDE_BRANCH_HOURS: 'Рабочие интервалы выходят за часы филиала либо часы филиала не настроены.',
    SCHEDULE_STALE: 'График уже изменён. Обновите данные перед сохранением.',
    SCHEDULE_FORBIDDEN: 'Недостаточно прав для изменения графика.',
    SCHEDULE_NOT_FOUND: 'Сотрудник не найден или неактивен.',
    SCHEDULE_WEEK_REQUIRED: 'Сначала опубликуйте обычную неделю, действующую на выбранную дату.',
};

export async function readSchedule(staffId: string, bizId: string, from: string, to: string): Promise<ScheduleSnapshot> {
    if (!validDate(from) || !validDate(to)) throw new Error('SCHEDULE_INVALID');
    const { data, error } = await getServiceClient().rpc('read_staff_schedule', {
        p_staff: staffId, p_biz: bizId, p_from: from, p_to: to,
    });
    if (error) throw error;
    return data as ScheduleSnapshot;
}

export async function scheduleHttp(request: Request, staffId?: string) {
    if (!explicitSchedulingEnabled()) return createErrorResponse('service_unavailable', 'Новая модель расписаний ещё не включена.', undefined, 503);
    try {
        const context = staffId ? await getBizContextForManagers() : await getStaffContext();
        const selectedStaff = staffId ?? ('staffId' in context ? context.staffId : '');
        if (!selectedStaff || !/^[0-9a-f-]{36}$/i.test(selectedStaff)) throw new Error('SCHEDULE_NOT_FOUND');
        if (request.method === 'GET') {
            const params = new URL(request.url).searchParams;
            if (params.has('draftKind')) {
                if (!staffId) return createErrorResponse('forbidden', 'Черновик доступен руководителю.', undefined, 403);
                const kind = params.get('draftKind'), date = params.get('draftDate') || '';
                if (!['week', 'day'].includes(kind || '') || !validDate(date)) throw new Error('SCHEDULE_INVALID');
                const { data, error } = await getServiceClient().rpc('read_staff_schedule_draft', {
                    p_staff: selectedStaff, p_biz: context.bizId, p_kind: kind, p_day: date,
                });
                if (error) throw error;
                return createSuccessResponse(data);
            }
            const { data: business, error } = await getServiceClient().from('businesses').select('tz').eq('id', context.bizId).single();
            if (error) throw error;
            const today = formatInTimeZone(new Date(), business?.tz || 'Asia/Bishkek', 'yyyy-MM-dd');
            const from = params.get('from') || today;
            if (!validDate(from)) throw new Error('SCHEDULE_INVALID');
            const end = new Date(`${from}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 13);
            return createSuccessResponse(await readSchedule(selectedStaff, context.bizId, from, params.get('to') || end.toISOString().slice(0, 10)));
        }
        if (!staffId) return createErrorResponse('forbidden', 'Сотрудник не может самостоятельно публиковать график.', undefined, 403);
        const body: unknown = await request.json();
        if (body && typeof body === 'object' && 'action' in body && body.action === 'reset-day') {
            const reset = body as { from?: unknown; expectedRevision?: unknown };
            if (typeof reset.from !== 'string' || !validDate(reset.from) ||
                typeof reset.expectedRevision !== 'number' || !Number.isSafeInteger(reset.expectedRevision) || reset.expectedRevision < 0) throw new Error('SCHEDULE_INVALID');
            const { data, error } = await getServiceClient().rpc('reset_staff_schedule_day', {
                p_staff: staffId, p_biz: context.bizId, p_actor: context.userId,
                p_expected_revision: reset.expectedRevision, p_day: reset.from,
            });
            if (error) throw error;
            if (!data?.ok) return createErrorResponse('conflict', 'Обычный график конфликтует с записями клиентов.', data?.conflicts, 409);
            return createSuccessResponse(data);
        }
        validatePublishSchedule(body);
        const { data, error } = await getServiceClient().rpc('publish_staff_schedule', {
            p_staff: staffId, p_biz: context.bizId, p_actor: context.userId,
            p_expected_revision: body.expectedRevision, p_kind: body.kind, p_from: body.from,
            p_branch: body.branchId, p_days: body.days,
        });
        if (error) throw error;
        if (!data?.ok) return createErrorResponse('conflict', 'Изменение затрагивает записи клиентов. Сначала перенесите или отмените конфликтующие записи.', data?.conflicts, 409);
        return createSuccessResponse(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : (error as { message?: string })?.message || '';
        const code = Object.keys(messages).find(key => message.includes(key));
        if (code) return createErrorResponse(code, messages[code], undefined,
            code === 'SCHEDULE_STALE' ? 409 : code === 'SCHEDULE_FORBIDDEN' ? 403 : code === 'SCHEDULE_NOT_FOUND' ? 404 : 400);
        return handleApiError(error, 'ExplicitSchedule', 'Не удалось загрузить или сохранить расписание. Изменения не применены.');
    }
}
