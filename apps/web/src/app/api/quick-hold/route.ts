import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";

type HoldSlotArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_service_id: string;
    p_staff_id: string;
    p_start: string; // ISO-строка с таймзоной
};

export async function POST(req: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
        cookies: {get: (n) => cookieStore.get(n)?.value},
    });

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ok: false, error: 'auth', message: 'Not signed in'}, {status: 401});
    }

    const {biz_id, service_id, staff_id, start_at} = await req.json();

    const {data: branch, error: eBranch} = await supabase
        .from('branches')
        .select('id')
        .eq('biz_id', biz_id)
        .eq('is_active', true)
        .order('created_at', {ascending: true})
        .limit(1)
        .maybeSingle<{ id: string }>();

    if (eBranch || !branch?.id) {
        return NextResponse.json({ok: false, error: 'no_branch', message: 'No active branch'}, {status: 400});
    }

    // тут мы ожидаем, что RPC вернёт именно booking_id (строку)
    const {data: bookingId, error} = await supabase.rpc<string, HoldSlotArgs>('hold_slot', {
        p_biz_id: biz_id,
        p_branch_id: branch.id,
        p_service_id: service_id,
        p_staff_id: staff_id,
        p_start: start_at,
    });

    if (error || !bookingId) {
        return NextResponse.json({ok: false, error: 'rpc', message: error?.message ?? 'no id'}, {status: 400});
    }

    // Уведомление
    notifyHold(bookingId, req).catch((err) => {
        console.error('notifyHold failed', err);
    });

    return NextResponse.json({ok: true, booking_id: bookingId});
}

async function notifyHold(bookingId: string | {}, req: Request) {
    await fetch(new URL('/api/notify', req.url), {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({type: 'hold', booking_id: bookingId}),
    });
}


