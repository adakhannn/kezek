export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type ScheduleItem = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

type Body = {
    schedule: ScheduleItem[];
};

export async function POST(req: Request, context: unknown) {
    try {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = (await req.json()) as Body;

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError) {
            return NextResponse.json({ ok: false, error: branchError.message }, { status: 400 });
        }
        if (!branch) {
            return NextResponse.json({ ok: false, error: 'Филиал не найден' }, { status: 404 });
        }

        // Валидация расписания
        if (!Array.isArray(body.schedule)) {
            return NextResponse.json({ ok: false, error: 'schedule должен быть массивом' }, { status: 400 });
        }

        // Удаляем старое расписание
        await admin.from('branch_working_hours').delete().eq('biz_id', bizId).eq('branch_id', branchId);

        // Вставляем новое расписание
        const inserts = body.schedule
            .filter((s) => s.intervals.length > 0) // Только рабочие дни
            .map((s) => ({
                biz_id: bizId,
                branch_id: branchId,
                day_of_week: s.day_of_week,
                intervals: s.intervals,
                breaks: s.breaks || [],
            }));

        if (inserts.length > 0) {
            const { error: insertError } = await admin.from('branch_working_hours').insert(inserts);
            if (insertError) {
                return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('BranchSchedule', 'branch schedule save error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export async function GET(req: Request, context: unknown) {
    try {
        const branchId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError) {
            return NextResponse.json({ ok: false, error: branchError.message }, { status: 400 });
        }
        if (!branch) {
            return NextResponse.json({ ok: false, error: 'Филиал не найден' }, { status: 404 });
        }

        // Загружаем расписание
        const { data: schedule, error: scheduleError } = await admin
            .from('branch_working_hours')
            .select('day_of_week, intervals, breaks')
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .order('day_of_week');

        if (scheduleError) {
            return NextResponse.json({ ok: false, error: scheduleError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, schedule: schedule || [] });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('BranchSchedule', 'branch schedule load error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

