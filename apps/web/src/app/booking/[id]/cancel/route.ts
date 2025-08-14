import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export async function POST(_: Request, {params}: { params: { id: string } }) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
        cookies: {get: (n) => cookieStore.get(n)?.value},
    });

    const {error} = await supabase.rpc('cancel_booking', {p_booking_id: params.id});
    if (error) console.error(error);
    // игнорируем ошибку на UI: просто вернёмся на страницу
    return NextResponse.redirect(new URL(`/booking/${params.id}`, new URL('/', 'http://localhost:3000')));
}
