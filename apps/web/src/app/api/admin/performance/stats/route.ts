// apps/web/src/app/api/admin/performance/stats/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getPerformanceStats, getOperations } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/performance/stats
 * Возвращает статистику производительности для всех операций
 */
export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('PerformanceStats', async () => {
        // Проверяем, что пользователь - супер-админ
        const supabase = getServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Проверяем, является ли пользователь супер-админом
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile?.is_super_admin) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Получаем список всех операций
        const operations = getOperations();

        // Получаем статистику для каждой операции за последние 5 минут
        const stats = operations.map((operation) => ({
            operation,
            ...getPerformanceStats(operation, 5 * 60 * 1000), // 5 минут
        }));

        return createSuccessResponse({
            stats,
            timestamp: Date.now(),
        });
    }));
}

