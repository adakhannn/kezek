// apps/web/src/app/api/staff/[id]/transfer/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    target_branch_id: string;
    copy_schedule?: boolean;
};

function isoDate(d: Date) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('StaffTransfer', async () => {
        const staffId = await getRouteParamRequired(context, 'id');

        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = (await req.json().catch(() => ({}))) as Body;
        const target = body.target_branch_id?.trim();
        const copySchedule = !!body.copy_schedule;

        if (!target) {
            return createErrorResponse('validation', 'Необходимо указать целевой филиал', undefined, 400);
        }

        // 1) валидируем сотрудника (используем унифицированную утилиту)
        const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; branch_id: string }>(
            admin,
            'staff',
            staffId,
            bizId,
            'id, biz_id, branch_id'
        );
        if (staffCheck.error || !staffCheck.data) {
            return createErrorResponse('forbidden', 'Сотрудник не принадлежит этому бизнесу', undefined, 403);
        }
        const st = staffCheck.data;
        if (String(st.branch_id) === String(target)) {
            return createErrorResponse('validation', 'Сотрудник уже находится в целевом филиале', undefined, 400);
        }

        // 2) цель валидна/активна (используем унифицированную утилиту)
        const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; is_active: boolean }>(
            admin,
            'branches',
            target,
            bizId,
            'id, biz_id, is_active'
        );
        if (branchCheck.error || !branchCheck.data) {
            return createErrorResponse('forbidden', 'Филиал не принадлежит этому бизнесу', undefined, 403);
        }
        const br = branchCheck.data;
        if (br.is_active === false) {
            return createErrorResponse('validation', 'Целевой филиал неактивен', undefined, 400);
        }

        // 3) текущая активная запись (valid_to IS NULL)
        const { data: currentAssign } = await admin
            .from('staff_branch_assignments')
            .select('id,valid_from,branch_id')
            .eq('staff_id', staffId)
            .is('valid_to', null)
            .maybeSingle();

        const today = new Date();
        const todayISO = isoDate(today);
        const yesterdayISO = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));

        if (currentAssign) {
            // если активная запись уже про этот же филиал — это гонка
            if (String(currentAssign.branch_id) === String(target)) {
                return createSuccessResponse({ note: 'ALREADY_ACTIVE_IN_TARGET' });
            }

            // закрываем активную запись:
            // если она начиналась сегодня или позже — удаляем её,
            // иначе ставим valid_to на вчера
            const started = String(currentAssign.valid_from);
            if (started >= todayISO) {
                await admin.from('staff_branch_assignments').delete().eq('id', currentAssign.id);
            } else {
                await admin
                    .from('staff_branch_assignments')
                    .update({ valid_to: yesterdayISO })
                    .eq('id', currentAssign.id);
            }
        }

        // 4) убедимся, что нет будущих записей, которые пересекутся с today
        const { data: futureAny } = await admin
            .from('staff_branch_assignments')
            .select('id')
            .eq('staff_id', staffId)
            .gte('valid_from', todayISO)
            .limit(1)
            .maybeSingle();

        if (futureAny) {
            // чтобы не словить EXCLUDE, начинаем со следующего дня
            const startNextDay = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
            const { error: eInsFuture } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: target,
                valid_from: startNextDay,
            });
            if (eInsFuture) {
                return createErrorResponse('validation', eInsFuture.message, undefined, 400);
            }
        } else {
            // обычный случай: стартуем сегодня
            const { error: eIns } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: target,
                valid_from: todayISO,
            });
            if (eIns) {
                // если всё равно поймали EXCLUDE (например, интервалы [] в constraint),
                // попробуем начать со следующего дня
                const startNextDay = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
                const { error: eIns2 } = await admin.from('staff_branch_assignments').insert({
                    biz_id: bizId,
                    staff_id: staffId,
                    branch_id: target,
                    valid_from: startNextDay,
                });
                if (eIns2) {
                    return createErrorResponse('validation', eIns2.message, undefined, 400);
                }
            }
        }

        // 5) синхронизируем кэш в staff
        const { error: eUpd } = await admin
            .from('staff')
            .update({ branch_id: target })
            .eq('id', staffId)
            .eq('biz_id', bizId);
        if (eUpd) {
            return createErrorResponse('validation', eUpd.message, undefined, 400);
        }

        // 6) по желанию копируем расписание
        if (copySchedule && st.branch_id) {
            const { data: wh } = await admin
                .from('working_hours')
                .select('day_of_week, intervals, breaks')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId);

            if (wh?.length) {
                await admin.from('working_hours').delete().eq('biz_id', bizId).eq('staff_id', staffId);

                const rows = wh.map((r) => ({
                    biz_id: bizId,
                    staff_id: staffId,
                    day_of_week: r.day_of_week,
                    intervals: r.intervals ?? [],
                    breaks: r.breaks ?? [],
                }));
                const { error: eCopy } = await admin.from('working_hours').insert(rows);
                if (eCopy) {
                    return createSuccessResponse({ warning: 'SCHEDULE_COPY_FAILED', detail: eCopy.message });
                }
            }
        }

        return createSuccessResponse();
    });
}
