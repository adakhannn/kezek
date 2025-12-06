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

        const {error, data} = await supabase
            .from('reviews')
            .insert({
                booking_id: body.booking_id,
                rating: body.rating,
                comment: body.comment ?? null,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true, id: data?.id});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
