export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {getBizContextForManagers} from '@/lib/authBiz';
import {getServiceClient} from '@/lib/supabaseService';

type Body = {
    target_branch_id: string;
    copy_schedule?: boolean;
};

export async function POST(req: Request, context: unknown) {
    // безопасно params
    const params =
        typeof context === 'object' && context !== null && 'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    const staffId = String(params.id ?? '');

    try {
        if (!staffId) return NextResponse.json({ok: false, error: 'STAFF_ID_REQUIRED'}, {status: 400});

        const {bizId} = await getBizContextForManagers();   // проверит роли и вернёт bizId
        const admin = getServiceClient();

        const body = (await req.json().catch(() => ({}))) as Body;
        const target = body.target_branch_id?.trim();
        const copySchedule = !!body.copy_schedule;

        if (!target) return NextResponse.json({ok: false, error: 'TARGET_BRANCH_REQUIRED'}, {status: 400});

        // 1) валидируем сотрудника и текущий филиал
        const {data: st, error: eSt} = await admin
            .from('staff')
            .select('id,biz_id,branch_id')
            .eq('id', staffId)
            .maybeSingle();

        if (eSt) return NextResponse.json({ok: false, error: eSt.message}, {status: 400});
        if (!st || String(st.biz_id) !== String(bizId)) {
            return NextResponse.json({ok: false, error: 'STAFF_NOT_IN_THIS_BUSINESS'}, {status: 403});
        }

        if (String(st.branch_id) === String(target)) {
            return NextResponse.json({ok: false, error: 'ALREADY_IN_TARGET_BRANCH'}, {status: 400});
        }

        // 2) ветвь-назначение принадлежит этому бизнесу?
        const {data: br} = await admin
            .from('branches')
            .select('id,biz_id,is_active')
            .eq('id', target)
            .maybeSingle();

        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS'}, {status: 400});
        }
        if (br.is_active === false) {
            return NextResponse.json({ok: false, error: 'TARGET_BRANCH_INACTIVE'}, {status: 400});
        }

        // 3) апдейт сотрудника
        const {error: eUpd} = await admin
            .from('staff')
            .update({branch_id: target})
            .eq('id', staffId)
            .eq('biz_id', bizId);

        if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});

        // 4) по желанию — копируем шаблон расписания (working_hours)
        if (copySchedule && st.branch_id) {
            // читаем существующее расписание «источник»
            const {data: wh} = await admin
                .from('working_hours')
                .select('weekday,start_minute,end_minute,breaks_json,slot_step_minutes')
                .eq('biz_id', bizId)
                .eq('branch_id', st.branch_id)
                .eq('staff_id', staffId);

            if (wh && wh.length) {
                // очищаем существующее расписание в целевом филиале (чтобы не плодить дубликаты)
                await admin
                    .from('working_hours')
                    .delete()
                    .eq('biz_id', bizId)
                    .eq('branch_id', target)
                    .eq('staff_id', staffId);

                // вставляем копию
                const rows = wh.map(r => ({
                    biz_id: bizId,
                    branch_id: target,
                    staff_id: staffId,
                    weekday: r.weekday,
                    start_minute: r.start_minute,
                    end_minute: r.end_minute,
                    breaks_json: r.breaks_json ?? null,
                    slot_step_minutes: r.slot_step_minutes ?? null,
                }));
                if (rows.length) {
                    const {error: eIns} = await admin.from('working_hours').insert(rows);
                    if (eIns) {
                        // не критично для трансфера: просто вернём warning
                        return NextResponse.json({ok: true, warning: 'SCHEDULE_COPY_FAILED', detail: eIns.message});
                    }
                }
            }
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
