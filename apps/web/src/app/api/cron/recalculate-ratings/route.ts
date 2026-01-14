// apps/web/src/app/api/cron/recalculate-ratings/route.ts
import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверка секретного ключа для безопасности
const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    try {
        // Проверяем секретный ключ для безопасности
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceClient();

        // Вызываем функцию пересчета рейтингов за вчерашний день
        // Функция сама пересчитает метрики за вчера и обновит агрегированные рейтинги
        const { data, error } = await supabase.rpc('recalculate_ratings_for_date', {
            p_date: null, // null означает вчерашний день (по умолчанию)
        });

        if (error) {
            console.error('[Recalculate Ratings Cron] Error:', error);
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        console.log('[Recalculate Ratings Cron] Successfully recalculated ratings');

        return NextResponse.json({
            ok: true,
            message: 'Ratings recalculated successfully',
        });
    } catch (error) {
        console.error('[Recalculate Ratings Cron] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

