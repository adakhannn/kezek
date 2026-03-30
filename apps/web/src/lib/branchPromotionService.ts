import { toNormalizedDateString } from '@/lib/dateUtils';

type PromotionType =
    | 'free_after_n_visits'
    | 'referral_free'
    | 'referral_discount_50'
    | 'birthday_discount'
    | 'first_visit_discount';

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
    valid_from?: string | null;
    valid_to?: string | null;
};

type Failure = {
    ok: false;
    status: 400 | 404 | 500;
    error: 'validation' | 'not_found' | 'internal';
    message: string;
};

type Success<T> = {
    ok: true;
    payload?: T;
};

export async function updateBranchPromotion({
    admin,
    branchId,
    promotionId,
    bizId,
    body,
}: {
    admin: any;
    branchId: string;
    promotionId: string;
    bizId: string;
    body: PromotionUpdateBody;
}): Promise<Failure | Success<{ promotion: Record<string, unknown> }>> {
    const { data: promotion, error: promotionError } = await admin
        .from('branch_promotions')
        .select('id, branch_id, biz_id, promotion_type')
        .eq('id', promotionId)
        .eq('branch_id', branchId)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (promotionError || !promotion) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Акция не найдена или доступ запрещен',
        };
    }

    const validation = validatePromotionUpdate({
        currentPromotionType: promotion.promotion_type,
        body,
    });
    if (validation) {
        return validation;
    }

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
    if (body.valid_from !== undefined) {
        updateData.valid_from = toNormalizedDateString(body.valid_from) ?? null;
    }
    if (body.valid_to !== undefined) {
        updateData.valid_to = toNormalizedDateString(body.valid_to) ?? null;
    }

    const { data: updatedPromotion, error: updateError } = await admin
        .from('branch_promotions')
        .update(updateData)
        .eq('id', promotionId)
        .select('*')
        .single();

    if (updateError) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: updateError.message,
        };
    }

    return {
        ok: true,
        payload: {
            promotion: updatedPromotion,
        },
    };
}

export async function deleteBranchPromotion({
    admin,
    branchId,
    promotionId,
    bizId,
}: {
    admin: any;
    branchId: string;
    promotionId: string;
    bizId: string;
}): Promise<Failure | Success<void>> {
    const { data: promotion, error: promotionError } = await admin
        .from('branch_promotions')
        .select('id, branch_id, biz_id')
        .eq('id', promotionId)
        .eq('branch_id', branchId)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (promotionError || !promotion) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Акция не найдена или доступ запрещен',
        };
    }

    const { error: deleteError } = await admin
        .from('branch_promotions')
        .delete()
        .eq('id', promotionId);

    if (deleteError) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: deleteError.message,
        };
    }

    return {
        ok: true,
    };
}

function validatePromotionUpdate({
    currentPromotionType,
    body,
}: {
    currentPromotionType: PromotionType;
    body: PromotionUpdateBody;
}): Failure | null {
    if (body.promotion_type || body.params) {
        const promotionType = body.promotion_type || currentPromotionType;
        const params = body.params;

        if (promotionType === 'free_after_n_visits') {
            const visitCount = params?.visit_count;
            if (visitCount !== undefined && (typeof visitCount !== 'number' || visitCount < 1)) {
                return {
                    ok: false,
                    status: 400,
                    error: 'validation',
                    message: 'Количество визитов должно быть больше 0',
                };
            }
        }

        if (promotionType === 'birthday_discount' || promotionType === 'first_visit_discount') {
            const discountPercent = params?.discount_percent;
            if (
                discountPercent !== undefined &&
                (typeof discountPercent !== 'number' ||
                    discountPercent < 1 ||
                    discountPercent > 100)
            ) {
                return {
                    ok: false,
                    status: 400,
                    error: 'validation',
                    message: 'Процент скидки должен быть от 1 до 100',
                };
            }
        }
    }

    return null;
}
