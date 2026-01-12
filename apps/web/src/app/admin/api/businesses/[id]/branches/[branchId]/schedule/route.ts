export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type ScheduleItem = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

type Body = {
    schedule: ScheduleItem[];
};

function extractIds(urlStr: string): { id: string; branchId: string } {
    const parts = urlStr.split('/');
    const iBranches = parts.indexOf('branches');
    return { id: parts[parts.indexOf('businesses') + 1] ?? '', branchId: iBranches >= 0 ? parts[iBranches + 1] ?? '' : '' };
}

export async function POST(req: Request) {
    try {
        const { id, branchId } = extractIds(req.url);

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', id)
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
        await admin.from('branch_working_hours').delete().eq('biz_id', id).eq('branch_id', branchId);

        // Вставляем новое расписание
        const inserts = body.schedule
            .filter((s) => s.intervals.length > 0) // Только рабочие дни
            .map((s) => ({
                biz_id: id,
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
        console.error('branch schedule save error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { id, branchId } = extractIds(req.url);

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const admin = createClient(URL, SERVICE);

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', id)
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
            .eq('biz_id', id)
            .eq('branch_id', branchId)
            .order('day_of_week');

        if (scheduleError) {
            return NextResponse.json({ ok: false, error: scheduleError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, schedule: schedule || [] });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('branch schedule load error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

