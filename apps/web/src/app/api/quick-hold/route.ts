import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';

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

    // найдём первый активный филиал бизнеса
    const {data: branch, error: eBranch} = await supabase
        .from('branches')
        .select('id')
        .eq('biz_id', biz_id)
        .eq('is_active', true)
        .order('created_at', {ascending: true})
        .limit(1)
        .maybeSingle();

    if (eBranch || !branch?.id) {
        return NextResponse.json({ok: false, error: 'no_branch', message: 'No active branch'}, {status: 400});
    }

    // вызываем уже существующий RPC hold_slot (он сам выставит TTL и длительность по услуге)
    const {data: bookingId, error} = await supabase.rpc('hold_slot', {
        p_biz_id: biz_id,
        p_branch_id: branch.id,
        p_service_id: service_id,
        p_staff_id: staff_id,
        p_start: start_at, // формат ISO с таймзоной (+06:00)
    });

    if (error) {
        return NextResponse.json({ok: false, error: 'rpc', message: error.message}, {status: 400});
    }

    return NextResponse.json({ok: true, booking_id: bookingId});
}
