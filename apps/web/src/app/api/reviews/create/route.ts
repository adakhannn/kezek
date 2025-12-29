// apps/web/src/app/api/reviews/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { booking_id: string; rating: number; comment?: string };

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;
        if (!body.booking_id || !body.rating) {
            return NextResponse.json({ok: false, error: 'BAD_REQUEST'}, {status: 400});
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get: n => cookieStore.get(n)?.value, set: () => {
                    }, remove: () => {
                    }
                }
            }
        );

        // Получаем текущего пользователя
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            return NextResponse.json({ok: false, error: 'UNAUTHORIZED'}, {status: 401});
        }

        const userId = auth.user.id;

        // Проверяем, что запись принадлежит текущему пользователю
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, client_id, status')
            .eq('id', body.booking_id)
            .maybeSingle();

        if (bookingError || !booking) {
            return NextResponse.json({ok: false, error: 'BOOKING_NOT_FOUND'}, {status: 404});
        }

        // Проверяем, что запись принадлежит текущему пользователю
        if (booking.client_id !== userId) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }

        // Проверяем, что отзыв еще не существует
        const { data: existingReview } = await supabase
            .from('reviews')
            .select('id, client_id')
            .eq('booking_id', body.booking_id)
            .maybeSingle();

        if (existingReview) {
            // Если отзыв существует и принадлежит текущему пользователю, обновляем его
            if (existingReview.client_id === userId) {
                const {error, data} = await supabase
                    .from('reviews')
                    .update({
                        rating: body.rating,
                        comment: body.comment ?? null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingReview.id)
                    .select('id')
                    .single();

                if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

                return NextResponse.json({ok: true, id: data?.id, updated: true});
            } else {
                // Отзыв существует, но принадлежит другому пользователю
                return NextResponse.json({ok: false, error: 'REVIEW_ALREADY_EXISTS'}, {status: 400});
            }
        }

        // Создаем новый отзыв с client_id
        const {error, data} = await supabase
            .from('reviews')
            .insert({
                booking_id: body.booking_id,
                client_id: userId,
                rating: body.rating,
                comment: body.comment ?? null,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true, id: data?.id, updated: false});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
