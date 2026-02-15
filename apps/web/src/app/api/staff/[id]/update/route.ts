// apps/web/src/app/api/staff/[id]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master?: number;
    percent_salon?: number;
    hourly_rate?: number | null;
};

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('StaffUpdate', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const staffId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        let body: Body;
        try {
            body = await req.json();
        } catch (e) {
            logError('StaffUpdate', 'Error parsing JSON', e);
            return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
        }

        // Валидация обязательных полей
        if (!staffId) {
            logError('StaffUpdate', 'Missing staffId');
            return createErrorResponse('validation', 'Отсутствует ID сотрудника', undefined, 400);
        }
        if (!body.full_name || typeof body.full_name !== 'string' || body.full_name.trim() === '') {
            logError('StaffUpdate', 'Invalid full_name', { full_name: body.full_name });
            return createErrorResponse('validation', 'Неверное имя сотрудника', undefined, 400);
        }
        if (!body.branch_id || typeof body.branch_id !== 'string') {
            logError('StaffUpdate', 'Invalid branch_id', { branch_id: body.branch_id });
            return createErrorResponse('validation', 'Неверный ID филиала', undefined, 400);
        }

        // 1) staff принадлежит бизнесу? (используем унифицированную утилиту)
        const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; branch_id: string }>(
            admin,
            'staff',
            staffId,
            bizId,
            'id, biz_id, branch_id'
        );
        if (staffCheck.error || !staffCheck.data) {
            return createErrorResponse('forbidden', staffCheck.error || 'Сотрудник не принадлежит этому бизнесу', undefined, 403);
        }
        const st = staffCheck.data;

        // 2) новый branch принадлежит этому бизнесу? (используем унифицированную утилиту)
        const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; is_active: boolean }>(
            admin,
            'branches',
            body.branch_id,
            bizId,
            'id, biz_id, is_active'
        );
        if (branchCheck.error || !branchCheck.data) {
            return createErrorResponse('validation', branchCheck.error || 'Филиал не принадлежит этому бизнесу', undefined, 400);
        }
        const br = branchCheck.data;
        if (br.is_active === false) {
            return createErrorResponse('validation', 'Целевой филиал неактивен', undefined, 400);
        }

        const isBranchChanged = String(st.branch_id) !== String(body.branch_id);

        // 3) обновляем карточку сотрудника (ФИО, контакты, активность, проценты)
        {
            const updateData: {
                full_name: string;
                email: string | null;
                phone: string | null;
                is_active: boolean;
                percent_master?: number;
                percent_salon?: number;
                hourly_rate?: number | null;
            } = {
                full_name: body.full_name,
                email: body.email ?? null,
                phone: body.phone ?? null,
                is_active: !!body.is_active,
            };

            // Обновляем проценты, если они переданы
            if (typeof body.percent_master === 'number' && typeof body.percent_salon === 'number') {
                const sum = body.percent_master + body.percent_salon;
                if (Math.abs(sum - 100) > 0.01) {
                    return createErrorResponse('validation', 'Сумма процентов должна быть равна 100', undefined, 400);
                }
                updateData.percent_master = body.percent_master;
                updateData.percent_salon = body.percent_salon;
            }

            // Обновляем ставку за час, если она передана
            if (body.hourly_rate !== undefined) {
                // Сохраняем null если значение null или undefined
                // Если значение <= 0, также сохраняем null (ставка не может быть нулевой или отрицательной)
                if (body.hourly_rate === null || body.hourly_rate === undefined) {
                    updateData.hourly_rate = null;
                } else {
                    const numVal = Number(body.hourly_rate);
                    updateData.hourly_rate = isNaN(numVal) || numVal <= 0 ? null : numVal;
                }
            } else {
                // Если hourly_rate не передан, не обновляем его (сохраняем текущее значение)
                // Но для явного обновления нужно всегда передавать это поле
            }

            const { error: eUpd } = await admin
                .from('staff')
                .update(updateData)
                .eq('id', staffId)
                .eq('biz_id', bizId);
            
            if (eUpd) {
                logError('StaffUpdate', 'Error updating staff', { error: eUpd, updateData });
                return createErrorResponse('internal', eUpd.message, undefined, 400);
            }
        }

        // 4) если филиал меняется — делаем корректный перенос (assignments + кэш)
        if (isBranchChanged) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // закрыть открытое назначение
            await admin
                .from('staff_branch_assignments')
                .update({ valid_to: today })
                .eq('staff_id', staffId)
                .is('valid_to', null);

            // создать новое назначение
            const { error: eIns } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: body.branch_id,
                valid_from: today,
            });
            if (eIns) return createErrorResponse('internal', eIns.message, undefined, 400);

            // синхронизировать кэш
            const { error: eCache } = await admin
                .from('staff')
                .update({ branch_id: body.branch_id })
                .eq('id', staffId)
                .eq('biz_id', bizId);
            if (eCache) return createErrorResponse('internal', eCache.message, undefined, 400);
        }

        return createSuccessResponse({ transferred: isBranchChanged });
    });
}
