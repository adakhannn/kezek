// apps/web/src/app/api/staff/[id]/transfer/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
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
    try {
        const staffId = await getRouteParamRequired(context, 'id');

        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = (await req.json().catch(() => ({}))) as Body;
        const target = body.target_branch_id?.trim();
        const copySchedule = !!body.copy_schedule;

        if (!target) return NextResponse.json({ ok: false, error: 'TARGET_BRANCH_REQUIRED' }, { status: 400 });

        // 1) валидируем сотрудника
        const { data: st, error: eSt } = await admin
            .from('staff')
            .select('id,biz_id,branch_id')
            .eq('id', staffId)
            .maybeSingle();
        if (eSt) return NextResponse.json({ ok: false, error: eSt.message }, { status: 400 });
        if (!st || String(st.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'STAFF_NOT_IN_THIS_BUSINESS' }, { status: 403 });
        }
        if (String(st.branch_id) === String(target)) {
            return NextResponse.json({ ok: false, error: 'ALREADY_IN_TARGET_BRANCH' }, { status: 400 });
        }

        // 2) цель валидна/активна
        const { data: br } = await admin
            .from('branches')
            .select('id,biz_id,is_active')
            .eq('id', target)
            .maybeSingle();
        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }
        if (br.is_active === false) {
            return NextResponse.json({ ok: false, error: 'TARGET_BRANCH_INACTIVE' }, { status: 400 });
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
                return NextResponse.json({ ok: true, note: 'ALREADY_ACTIVE_IN_TARGET' });
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
            if (eInsFuture) return NextResponse.json({ ok: false, error: eInsFuture.message }, { status: 400 });
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
                if (eIns2) return NextResponse.json({ ok: false, error: eIns2.message }, { status: 400 });
            }
        }

        // 5) синхронизируем кэш в staff
        const { error: eUpd } = await admin
            .from('staff')
            .update({ branch_id: target })
            .eq('id', staffId)
            .eq('biz_id', bizId);
        if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });

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
                    return NextResponse.json({ ok: true, warning: 'SCHEDULE_COPY_FAILED', detail: eCopy.message });
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
