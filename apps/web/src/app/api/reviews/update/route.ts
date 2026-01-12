// apps/web/src/app/api/reviews/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { review_id: string; rating: number; comment?: string };

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;
        if (!body.review_id || !body.rating) {
            return NextResponse.json({ok: false, error: 'BAD_REQUEST'}, {status: 400});
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get: (n: string) => cookieStore.get(n)?.value, set: () => {
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

        // Проверяем, что отзыв существует и принадлежит текущему пользователю
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .select('id, client_id, booking_id')
            .eq('id', body.review_id)
            .maybeSingle();

        if (reviewError || !review) {
            return NextResponse.json({ok: false, error: 'REVIEW_NOT_FOUND'}, {status: 404});
        }

        if (review.client_id !== userId) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }

        // Обновляем отзыв
        const {error, data} = await supabase
            .from('reviews')
            .update({
                rating: body.rating,
                comment: body.comment ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', body.review_id)
            .select('id')
            .single();

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true, id: data?.id});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

