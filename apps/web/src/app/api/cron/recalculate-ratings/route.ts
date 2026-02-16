// apps/web/src/app/api/cron/recalculate-ratings/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { measurePerformance } from '@/lib/performance';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверка секретного ключа для безопасности
const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    return withErrorHandler('RecalculateRatingsCron', async () => {
        // Проверяем секретный ключ для безопасности
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const supabase = getServiceClient();

        // Вызываем функцию пересчета рейтингов за вчерашний день
        // Функция сама пересчитает метрики за вчера и обновит агрегированные рейтинги
        // Мониторинг производительности пересчета рейтингов
        const { data, error } = await measurePerformance(
            'recalculate_ratings',
            async () => {
                return await supabase.rpc('recalculate_ratings_for_date', {
                    p_date: null, // null означает вчерашний день (по умолчанию)
                });
            },
            { date: null }
        );

        if (error) {
            logError('RecalculateRatingsCron', 'RPC recalculate_ratings_for_date failed', error);
            return createErrorResponse('internal', error.message, undefined, 500);
        }

        logDebug('RecalculateRatingsCron', 'Successfully recalculated ratings', { data });

        return createSuccessResponse({
            message: 'Ratings recalculated successfully',
        });
    });
}

