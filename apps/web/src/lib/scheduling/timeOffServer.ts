import { formatInTimeZone } from 'date-fns-tz';

import { explicitSchedulingEnabled } from './config';
import { validDate } from './model';

import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/apiErrorHandler';
import { BizAccessError, getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function staffTimeOffHttp(request: Request, staffId: string) {
    if (!explicitSchedulingEnabled()) return createErrorResponse('service_unavailable', 'Новая модель расписаний ещё не включена.', undefined, 503);
    try {
        if (!uuid.test(staffId)) return createErrorResponse('not_found', 'Сотрудник не найден.', undefined, 404);
        const context = await getBizContextForManagers();
        const service = getServiceClient();
        const { data: staff, error: staffError } = await service.from('staff').select('id')
            .eq('id', staffId).eq('biz_id', context.bizId).eq('is_active', true).maybeSingle();
        if (staffError) throw staffError;
        if (!staff) return createErrorResponse('not_found', 'Сотрудник не найден.', undefined, 404);
        const { data: business, error: businessError } = await service.from('businesses').select('tz')
            .eq('id', context.bizId).single();
        if (businessError) throw businessError;
        const today = formatInTimeZone(new Date(), business?.tz || 'Asia/Bishkek', 'yyyy-MM-dd');

        if (request.method === 'GET') {
            const { data, error } = await service.from('staff_time_off')
                .select('id,date_from,date_to,reason,created_at,cancelled_at')
                .eq('staff_id', staffId).eq('biz_id', context.bizId)
                .order('date_from', { ascending: false }).limit(100);
            if (error) throw error;
            return createSuccessResponse({ today, items: data || [] });
        }

        const body: unknown = await request.json();
        if (!body || typeof body !== 'object') return createErrorResponse('invalid', 'Проверьте данные отсутствия.', undefined, 400);
        if (request.method === 'POST') {
            const input = body as { from?: unknown; to?: unknown; reason?: unknown };
            if (typeof input.from !== 'string' || typeof input.to !== 'string' ||
                !validDate(input.from) || !validDate(input.to) || input.from < today || input.to < input.from ||
                (Date.parse(input.to) - Date.parse(input.from)) / 86400000 > 365 ||
                (input.reason != null && (typeof input.reason !== 'string' || input.reason.length > 240))) {
                return createErrorResponse('invalid', 'Проверьте даты и комментарий (не более 240 символов).', undefined, 400);
            }
            const { data, error } = await service.from('staff_time_off').insert({
                staff_id: staffId, biz_id: context.bizId, date_from: input.from, date_to: input.to,
                reason: typeof input.reason === 'string' ? input.reason.trim() || null : null,
                created_by: context.userId,
            }).select('id,date_from,date_to,reason,created_at,cancelled_at').single();
            if (error) throw error;
            return createSuccessResponse(data);
        }

        if (request.method === 'PATCH') {
            const input = body as { id?: unknown };
            if (typeof input.id !== 'string' || !uuid.test(input.id)) return createErrorResponse('invalid', 'Не указано отсутствие.', undefined, 400);
            const { data: existing, error: existingError } = await service.from('staff_time_off')
                .select('id,date_from,cancelled_at').eq('id', input.id).eq('staff_id', staffId)
                .eq('biz_id', context.bizId).maybeSingle();
            if (existingError) throw existingError;
            if (!existing) return createErrorResponse('not_found', 'Отсутствие не найдено.', undefined, 404);
            if (existing.cancelled_at) return createErrorResponse('conflict', 'Отсутствие уже отменено. Обновите страницу.', undefined, 409);
            if (existing.date_from < today) return createErrorResponse('invalid', 'Начавшееся отсутствие нельзя отменить целиком.', undefined, 400);
            const { data, error } = await service.from('staff_time_off')
                .update({ cancelled_at: new Date().toISOString(), cancelled_by: context.userId })
                .eq('id', input.id).eq('staff_id', staffId).eq('biz_id', context.bizId)
                .is('cancelled_at', null)
                .select('id,date_from,date_to,reason,created_at,cancelled_at').maybeSingle();
            if (error) throw error;
            if (!data) return createErrorResponse('conflict', 'Отсутствие уже изменено. Обновите страницу.', undefined, 409);
            return createSuccessResponse(data);
        }
        return createErrorResponse('invalid', 'Метод не поддерживается.', undefined, 405);
    } catch (error) {
        if (error instanceof BizAccessError) return createErrorResponse(
            error.code === 'NOT_AUTHENTICATED' ? 'auth' : 'forbidden',
            error.code === 'NOT_AUTHENTICATED' ? 'Войдите в аккаунт.' : 'Нет доступа к управлению сотрудником.',
            undefined, error.code === 'NOT_AUTHENTICATED' ? 401 : 403);
        const message = error instanceof Error ? error.message : (error as { message?: string })?.message || '';
        if (message.includes('SCHEDULE_BOOKING_CONFLICT')) return createErrorResponse('conflict', 'На эти даты уже есть записи клиентов. Сначала перенесите или отмените их.', undefined, 409);
        if (message.includes('SCHEDULE_ABSENCE_OVERLAP')) return createErrorResponse('conflict', 'На эти даты уже назначено отсутствие.', undefined, 409);
        if (message.includes('SCHEDULE_INVALID')) return createErrorResponse('invalid', 'Не удалось изменить отсутствие. Обновите страницу.', undefined, 400);
        return handleApiError(error, 'StaffTimeOff', 'Не удалось изменить отсутствие. Изменения не применены.');
    }
}
