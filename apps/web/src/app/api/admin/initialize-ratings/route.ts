// apps/web/src/app/api/admin/initialize-ratings/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
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
    // Применяем rate limiting для тяжелой админской операции
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        () => withErrorHandler('InitializeRatings', async () => {
        const cookieStore = await cookies();
        const supabase = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
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
            return createErrorResponse('internal', superErr.message, undefined, 400);
        }
        if (!superRow) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        const body = await req.json().catch(() => ({}));
        const daysBack = Number(body.days_back) || 30;

        const admin = getServiceClient();

        // Вызываем функцию инициализации рейтингов
        const { error: initError } = await admin.rpc('initialize_all_ratings', {
            p_days_back: daysBack,
        });

        if (initError) {
            logError('InitializeRatings', 'Error initializing ratings', initError);
            return createErrorResponse('internal', initError.message, undefined, 500);
        }

        logDebug('InitializeRatings', 'Successfully initialized ratings');

        return createSuccessResponse({
            message: `Ratings initialized for last ${daysBack} days`,
        });
        })
    );
}

