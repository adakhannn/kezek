// apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts

import { withErrorHandler, createErrorResponse, createSuccessResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PromotionType = 'free_after_n_visits' | 'referral_free' | 'referral_discount_50' | 'birthday_discount' | 'first_visit_discount';

type PromotionBody = {
    promotion_type: PromotionType;
    params?: Record<string, unknown>;
    title_ru: string;
    title_ky?: string;
    title_en?: string;
    description_ru?: string;
    description_ky?: string;
    description_en?: string;
    is_active?: boolean;
    valid_from?: string | null; // ISO date string
    valid_to?: string | null; // ISO date string
};

/**
 * GET /api/dashboard/branches/[branchId]/promotions
 * Получает список акций филиала
 */
export async function GET(req: Request, context: unknown) {
    return withErrorHandler<ApiSuccessResponse<{ promotions: unknown[] } | { promotion: unknown }>>('BranchPromotions', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'branchId');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал принадлежит этому бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError || !branch) {
            return createErrorResponse('not_found', 'Филиал не найден или доступ запрещен', undefined, 404);
        }

        // Получаем акции филиала
        const { data: promotions, error: promotionsError } = await admin
            .from('branch_promotions')
            .select('*')
            .eq('branch_id', branchId)
            .eq('biz_id', bizId)
            .order('created_at', { ascending: false });

        if (promotionsError) {
            return createErrorResponse('internal', promotionsError.message, undefined, 500);
        }

        // Получаем статистику использования для каждой акции
        const promotionsWithStats = await Promise.all(
            (promotions || []).map(async (promo) => {
                const { count, error } = await admin
                    .from('client_promotion_usage')
                    .select('*', { count: 'exact', head: true })
                    .eq('promotion_id', promo.id);

                if (error) {
                    logError('BranchPromotions', 'Error counting promotion usage', error);
                }

                return {
                    ...promo,
                    usage_count: count || 0,
                };
            })
        );

        return createSuccessResponse({ promotions: promotionsWithStats });
    });
}

/**
 * POST /api/dashboard/branches/[branchId]/promotions
 * Создает новую акцию для филиала
 */
export async function POST(req: Request, context: unknown) {
    // Применяем rate limiting для создания акций
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('BranchPromotions', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'branchId');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал принадлежит этому бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError || !branch) {
            return createErrorResponse('not_found', 'Филиал не найден или доступ запрещен', undefined, 404);
        }

        const body = (await req.json()) as PromotionBody;

        // Валидация
        const { promotion_type, params, title_ru, is_active, valid_from, valid_to } = body;

        if (!promotion_type || !title_ru) {
            return createErrorResponse('validation', 'Необходимо указать тип акции и заголовок', undefined, 400);
        }

        // Валидация параметров для разных типов акций
        if (promotion_type === 'free_after_n_visits') {
            const visitCount = params?.visit_count;
            if (!visitCount || typeof visitCount !== 'number' || visitCount < 1) {
                return createErrorResponse('validation', 'Количество визитов должно быть больше 0', undefined, 400);
            }
        }

        if (promotion_type === 'birthday_discount' || promotion_type === 'first_visit_discount') {
            const discountPercent = params?.discount_percent;
            if (!discountPercent || typeof discountPercent !== 'number' || discountPercent < 1 || discountPercent > 100) {
                return createErrorResponse('validation', 'Процент скидки должен быть от 1 до 100', undefined, 400);
            }
        }

        // Создаем акцию
        const { data: promotion, error: insertError } = await admin
            .from('branch_promotions')
            .insert({
                branch_id: branchId,
                biz_id: bizId,
                promotion_type,
                params: params || {},
                title_ru,
                title_ky: body.title_ky || null,
                title_en: body.title_en || null,
                description_ru: body.description_ru || null,
                description_ky: body.description_ky || null,
                description_en: body.description_en || null,
                is_active: is_active !== undefined ? is_active : true,
                valid_from: valid_from ? new Date(valid_from).toISOString().split('T')[0] : null,
                valid_to: valid_to ? new Date(valid_to).toISOString().split('T')[0] : null,
            })
            .select('*')
            .single();

        if (insertError) {
            return createErrorResponse('internal', insertError.message, undefined, 500);
        }

        return createSuccessResponse({ promotion });
        })
    );
}

