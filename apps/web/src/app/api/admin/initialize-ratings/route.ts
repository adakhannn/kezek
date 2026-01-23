// apps/web/src/app/api/admin/initialize-ratings/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { logDebug, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/admin/initialize-ratings
 * Инициализирует рейтинги для всех бизнесов, филиалов и сотрудников
 * Доступно только суперадминам
 */
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
        }

        // Проверяем, что пользователь - суперадмин
        const { data: superRow, error: superErr } = await supabase
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) {
            return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        }
        if (!superRow) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const daysBack = Number(body.days_back) || 30;

        const admin = getServiceClient();

        // Вызываем функцию инициализации рейтингов
        const { data, error } = await admin.rpc('initialize_all_ratings', {
            p_days_back: daysBack,
        });

        if (error) {
            logError('InitializeRatings', 'Error initializing ratings', error);
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('InitializeRatings', 'Successfully initialized ratings');

        return NextResponse.json({
            ok: true,
            message: `Ratings initialized for last ${daysBack} days`,
        });
    } catch (error) {
        logError('InitializeRatings', 'Unexpected error', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

