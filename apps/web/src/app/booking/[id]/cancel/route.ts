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

    // Проверяем текущий статус брони
    const {data: booking} = await supabase
        .from('bookings')
        .select('id, status, client_id')
        .eq('id', id)
        .maybeSingle();

    // Если уже отменена, редиректим
    if (booking?.status === 'cancelled') {
        return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
    }

    // Пытаемся отменить через RPC
    const {error} = await supabase.rpc('cancel_booking', {p_booking_id: id});
    
    // Если ошибка связана с назначением сотрудника, обновляем статус напрямую
    if (error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
            // Получаем текущего пользователя
            const {data: {user}} = await supabase.auth.getUser();
            if (!user || !booking || booking.client_id !== user.id) {
                return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
            }
            
            // Обновляем статус напрямую, минуя проверку назначения
            const {error: updateError} = await supabase
                .from('bookings')
                .update({status: 'cancelled'})
                .eq('id', id)
                .eq('client_id', user.id);
            
            if (updateError) {
                console.error(updateError);
                return NextResponse.json({ok: false, error: updateError.message}, {status: 400});
            }
        } else {
            console.error(error);
            return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }
    }

    await fetch(new URL('/api/notify', req.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'cancel', booking_id: id }),
    });

    // вернём редирект обратно на карточку брони
    return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
}
