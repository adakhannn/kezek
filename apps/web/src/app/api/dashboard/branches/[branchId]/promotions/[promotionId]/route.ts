// apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PromotionType = 'free_after_n_visits' | 'referral_free' | 'referral_discount_50' | 'birthday_discount' | 'first_visit_discount';

type PromotionUpdateBody = {
    promotion_type?: PromotionType;
    params?: Record<string, unknown>;
    title_ru?: string;
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
 * PATCH /api/dashboard/branches/[branchId]/promotions/[promotionId]
 * Обновляет акцию филиала
 */
export async function PATCH(req: Request, context: unknown) {
    return withErrorHandler('BranchPromotion', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'branchId');
        const promotionId = await getRouteParamUuid(context, 'promotionId');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал и акция принадлежат этому бизнесу
        const { data: promotion, error: promotionError } = await admin
            .from('branch_promotions')
            .select('id, branch_id, biz_id, promotion_type')
            .eq('id', promotionId)
            .eq('branch_id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (promotionError || !promotion) {
            return createErrorResponse('not_found', 'Акция не найдена или доступ запрещен', undefined, 404);
        }

        const body = (await req.json()) as PromotionUpdateBody;

        // Валидация параметров, если они изменяются
        if (body.promotion_type || body.params) {
            const promotionType = body.promotion_type || promotion.promotion_type;
            const params = body.params;

            if (promotionType === 'free_after_n_visits') {
                const visitCount = params?.visit_count;
                if (visitCount !== undefined && (typeof visitCount !== 'number' || visitCount < 1)) {
                    return createErrorResponse('validation', 'Количество визитов должно быть больше 0', undefined, 400);
                }
            }

            if (promotionType === 'birthday_discount' || promotionType === 'first_visit_discount') {
                const discountPercent = params?.discount_percent;
                if (discountPercent !== undefined && (typeof discountPercent !== 'number' || discountPercent < 1 || discountPercent > 100)) {
                    return createErrorResponse('validation', 'Процент скидки должен быть от 1 до 100', undefined, 400);
                }
            }
        }

        // Формируем объект обновления
        const updateData: Record<string, unknown> = {};

        if (body.promotion_type !== undefined) updateData.promotion_type = body.promotion_type;
        if (body.params !== undefined) updateData.params = body.params;
        if (body.title_ru !== undefined) updateData.title_ru = body.title_ru;
        if (body.title_ky !== undefined) updateData.title_ky = body.title_ky || null;
        if (body.title_en !== undefined) updateData.title_en = body.title_en || null;
        if (body.description_ru !== undefined) updateData.description_ru = body.description_ru || null;
        if (body.description_ky !== undefined) updateData.description_ky = body.description_ky || null;
        if (body.description_en !== undefined) updateData.description_en = body.description_en || null;
        if (body.is_active !== undefined) updateData.is_active = body.is_active;
        if (body.valid_from !== undefined) updateData.valid_from = body.valid_from ? new Date(body.valid_from).toISOString().split('T')[0] : null;
        if (body.valid_to !== undefined) updateData.valid_to = body.valid_to ? new Date(body.valid_to).toISOString().split('T')[0] : null;

        // Обновляем акцию
        const { data: updatedPromotion, error: updateError } = await admin
            .from('branch_promotions')
            .update(updateData)
            .eq('id', promotionId)
            .select('*')
            .single();

        if (updateError) {
            return createErrorResponse('internal', updateError.message, undefined, 500);
        }

        return createSuccessResponse({ promotion: updatedPromotion });
    });
}

/**
 * DELETE /api/dashboard/branches/[branchId]/promotions/[promotionId]
 * Удаляет акцию филиала
 */
export async function DELETE(req: Request, context: unknown) {
    return withErrorHandler('BranchPromotion', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'branchId');
        const promotionId = await getRouteParamUuid(context, 'promotionId');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал и акция принадлежат этому бизнесу
        const { data: promotion, error: promotionError } = await admin
            .from('branch_promotions')
            .select('id, branch_id, biz_id')
            .eq('id', promotionId)
            .eq('branch_id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (promotionError || !promotion) {
            return createErrorResponse('not_found', 'Акция не найдена или доступ запрещен', undefined, 404);
        }

        // Удаляем акцию
        const { error: deleteError } = await admin
            .from('branch_promotions')
            .delete()
            .eq('id', promotionId);

        if (deleteError) {
            return createErrorResponse('internal', deleteError.message, undefined, 500);
        }

        return createSuccessResponse();
    });
}

