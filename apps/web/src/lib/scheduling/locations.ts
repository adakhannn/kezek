import { formatInTimeZone } from 'date-fns-tz';

import { explicitSchedulingEnabled } from './config';
import { validDate } from './model';

import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

export async function workLocationsHttp(request: Request, manager: boolean) {
    try {
        const params = new URL(request.url).searchParams;
        const bizId = manager ? (await getBizContextForManagers()).bizId : params.get('bizId');
        const from = params.get('from') || '', to = params.get('to') || '';
        if (!bizId || !/^[a-f0-9-]{36}$/i.test(bizId) || !validDate(from) || !validDate(to) ||
            to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 62) return createErrorResponse('validation', 'Некорректный период.', undefined, 400);
        const admin = getServiceClient();
        if (!manager) {
            const { data, error } = await admin.from('businesses').select('id,tz').eq('id', bizId).eq('is_approved', true).maybeSingle();
            if (error) throw error;
            if (!data) return createErrorResponse('not_found', 'Бизнес недоступен.', undefined, 404);
            if (from < formatInTimeZone(new Date(), data.tz || 'Asia/Bishkek', 'yyyy-MM-dd')) return createErrorResponse('validation', 'Прошедшие даты недоступны.', undefined, 400);
        }
        const result = explicitSchedulingEnabled()
            ? await admin.rpc('read_staff_work_locations', { p_biz: bizId, p_from: from, p_to: to })
            : await admin.from('staff_schedule_rules').select('staff_id, branch_id, date_on')
                .eq('biz_id', bizId).eq('kind', 'date').eq('is_active', true).gte('date_on', from).lte('date_on', to);
        if (result.error) throw result.error;
        return createSuccessResponse(result.data ?? []);
    } catch (error) { return handleApiError(error, 'WorkLocations', 'Не удалось определить филиалы сотрудников.'); }
}
