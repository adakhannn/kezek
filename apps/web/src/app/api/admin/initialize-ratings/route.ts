// apps/web/src/app/api/admin/initialize-ratings/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAYS_BACK_MIN = 1;
const DAYS_BACK_MAX = 365;
/** Максимум дней в одном батче при вызове с start_date/end_date (чтобы не превышать таймаут). */
const DATE_RANGE_CHUNK_DAYS_MAX = 31;

function parseDate(s: unknown): Date | null {
    if (typeof s !== 'string') return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/admin/initialize-ratings
 * Инициализирует рейтинги для всех бизнесов, филиалов и сотрудников.
 * Доступно только суперадминам.
 *
 * Body:
 * - days_back (1–365) — пересчёт за последние N дней и обновление агрегатов (по умолчанию 30).
 * - start_date, end_date (YYYY-MM-DD) — только пересчёт метрик за диапазон (без обновления агрегатов); для больших баз вызывать батчами по 7–31 день, затем один раз с finalize_only: true.
 * - finalize_only (true) — только обновить агрегированные рейтинги по уже рассчитанным метрикам.
 */
export async function POST(req: Request) {
    // Применяем rate limiting для тяжелой админской операции
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        () => withErrorHandler('InitializeRatings', async () => {
        const URL = getSupabaseUrl();
        const ANON = getSupabaseAnonKey();
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

        const body = (await req.json().catch(() => ({}))) as {
            days_back?: number;
            start_date?: string;
            end_date?: string;
            finalize_only?: boolean;
        };

        const admin = getServiceClient();

        // Режим: только обновить агрегированные рейтинги (после батчевого пересчёта метрик)
        if (body.finalize_only === true) {
            const { error: finError } = await admin.rpc('update_all_aggregated_ratings', {});
            if (finError) {
                logError('InitializeRatings', 'Error updating aggregated ratings', finError);
                return createErrorResponse('internal', finError.message, undefined, 500);
            }
            logDebug('InitializeRatings', 'Aggregated ratings updated');
            return createSuccessResponse({ message: 'Aggregated ratings updated' });
        }

        // Режим: пересчёт метрик только за указанный диапазон дат (без обновления агрегатов)
        const startDate = parseDate(body.start_date);
        const endDate = parseDate(body.end_date);
        if (startDate != null && endDate != null) {
            if (startDate > endDate) {
                return createErrorResponse('validation', 'start_date не должен быть больше end_date', undefined, 400);
            }
            const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > DATE_RANGE_CHUNK_DAYS_MAX) {
                return createErrorResponse(
                    'validation',
                    `Диапазон дат не должен превышать ${DATE_RANGE_CHUNK_DAYS_MAX} дней (указано ${diffDays}). Вызывайте батчами.`,
                    undefined,
                    400,
                );
            }
            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);
            const { error: rangeError } = await admin.rpc('recalculate_ratings_for_date_range', {
                p_start_date: startStr,
                p_end_date: endStr,
            });
            if (rangeError) {
                logError('InitializeRatings', 'Error recalculating ratings for date range', rangeError);
                return createErrorResponse('internal', rangeError.message, undefined, 500);
            }
            logDebug('InitializeRatings', 'Metrics recalculated for date range', { startStr, endStr });
            return createSuccessResponse({
                message: `Metrics recalculated from ${startStr} to ${endStr}. Вызовите с finalize_only: true для обновления рейтингов.`,
            });
        }

        // Режим по умолчанию: полная инициализация за последние days_back дней
        const rawDaysBack = body.days_back != null ? Number(body.days_back) : 30;
        const daysBack = Number.isFinite(rawDaysBack) ? Math.floor(rawDaysBack) : 30;

        if (daysBack < DAYS_BACK_MIN || daysBack > DAYS_BACK_MAX) {
            return createErrorResponse(
                'validation',
                `days_back должен быть от ${DAYS_BACK_MIN} до ${DAYS_BACK_MAX}`,
                undefined,
                400,
            );
        }

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

