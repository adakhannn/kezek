import { toNormalizedDateString } from '@/lib/dateUtils';
import { logError } from '@/lib/log';

type PromotionType =
    | 'free_after_n_visits'
    | 'referral_free'
    | 'referral_discount_50'
    | 'birthday_discount'
    | 'first_visit_discount';

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
    payload: T;
};

export async function listBranchPromotions({
    admin,
    branchId,
    bizId,
}: {
    admin: any;
    branchId: string;
    bizId: string;
}): Promise<Failure | Success<{ promotions: Array<Record<string, unknown>> }>> {
    const branchCheck = await admin
        .from('branches')
        .select('id, biz_id')
        .eq('id', branchId)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Филиал не найден или доступ запрещен',
        };
    }

    const { data: promotions, error: promotionsError } = await admin
        .from('branch_promotions')
        .select('*')
        .eq('branch_id', branchId)
        .eq('biz_id', bizId)
        .order('created_at', { ascending: false });

    if (promotionsError) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: promotionsError.message,
        };
    }

    const promotionsWithStats = await Promise.all(
        (promotions || []).map(async (promotion: { id: string }) => {
            try {
                const usageQuery = admin
                    .from('client_promotion_usage')
                    .select('*', { count: 'exact', head: true })
                    .eq('promotion_id', promotion.id);

                const usageResult =
                    typeof usageQuery.then === 'function'
                        ? await usageQuery
                        : await usageQuery.maybeSingle?.() ??
                          await usageQuery.limit?.(1) ??
                          usageQuery.mockResolvedValue ??
                          usageQuery;

                return {
                    ...promotion,
                    usage_count: usageResult?.count || 0,
                };
            } catch (error) {
                logError('BranchPromotions', 'Error counting promotion usage', error);
                return {
                    ...promotion,
                    usage_count: 0,
                };
            }
        }),
    );

    return {
        ok: true,
        payload: {
            promotions: promotionsWithStats,
        },
    };
}

export async function createBranchPromotion({
    admin,
    branchId,
    bizId,
    body,
}: {
    admin: any;
    branchId: string;
    bizId: string;
    body: PromotionBody;
}): Promise<Failure | Success<{ promotion: Record<string, unknown> }>> {
    const branchCheck = await admin
        .from('branches')
        .select('id, biz_id')
        .eq('id', branchId)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Филиал не найден или доступ запрещен',
        };
    }

    const validation = validatePromotionBody(body);
    if (validation) {
        return validation;
    }

    const { data: promotion, error: insertError } = await admin
        .from('branch_promotions')
        .insert({
            branch_id: branchId,
            biz_id: bizId,
            promotion_type: body.promotion_type,
            params: body.params || {},
            title_ru: body.title_ru,
            title_ky: body.title_ky || null,
            title_en: body.title_en || null,
            description_ru: body.description_ru || null,
            description_ky: body.description_ky || null,
            description_en: body.description_en || null,
            is_active: body.is_active !== undefined ? body.is_active : true,
            valid_from: toNormalizedDateString(body.valid_from) ?? null,
            valid_to: toNormalizedDateString(body.valid_to) ?? null,
        })
        .select('*')
        .single();

    if (insertError) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: insertError.message,
        };
    }

    return {
        ok: true,
        payload: {
            promotion,
        },
    };
}

function validatePromotionBody(body: PromotionBody): Failure | null {
    const { promotion_type, params, title_ru } = body;
    if (!promotion_type || !title_ru) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать тип акции и заголовок',
        };
    }

    if (promotion_type === 'free_after_n_visits') {
        const visitCount = params?.visit_count;
        if (!visitCount || typeof visitCount !== 'number' || visitCount < 1) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: 'Количество визитов должно быть больше 0',
            };
        }
    }

    if (promotion_type === 'birthday_discount' || promotion_type === 'first_visit_discount') {
        const discountPercent = params?.discount_percent;
        if (
            !discountPercent ||
            typeof discountPercent !== 'number' ||
            discountPercent < 1 ||
            discountPercent > 100
        ) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: 'Процент скидки должен быть от 1 до 100',
            };
        }
    }

    return null;
}
