import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export async function POST(
    req: Request,
    {params}: { params: Promise<{ id: string }> }
) {
    const {id} = await params; // ← обязательно await

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            // no-op для RSC/route handlers
            set: () => {
            },
            remove: () => {
            },
        },
    });

    const {error} = await supabase.rpc('cancel_booking', {p_booking_id: id});
    if (error) {
        console.error(error);
        return NextResponse.json({ok: false, error: error.message}, {status: 400});
    }

    // вернём редирект обратно на карточку брони
    return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
}
