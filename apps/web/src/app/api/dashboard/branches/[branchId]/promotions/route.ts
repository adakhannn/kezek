// apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
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
    try {
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
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_FOUND_OR_ACCESS_DENIED' }, { status: 404 });
        }

        // Получаем акции филиала
        const { data: promotions, error: promotionsError } = await admin
            .from('branch_promotions')
            .select('*')
            .eq('branch_id', branchId)
            .eq('biz_id', bizId)
            .order('created_at', { ascending: false });

        if (promotionsError) {
            return NextResponse.json({ ok: false, error: promotionsError.message }, { status: 500 });
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

        return NextResponse.json({
            ok: true,
            promotions: promotionsWithStats,
        });
    } catch (error) {
        logError('BranchPromotions', 'Unexpected error in GET promotions API', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/branches/[branchId]/promotions
 * Создает новую акцию для филиала
 */
export async function POST(req: Request, context: unknown) {
    try {
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
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_FOUND_OR_ACCESS_DENIED' }, { status: 404 });
        }

        const body = (await req.json()) as PromotionBody;

        // Валидация
        const { promotion_type, params, title_ru, is_active, valid_from, valid_to } = body;

        if (!promotion_type || !title_ru) {
            return NextResponse.json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
        }

        // Валидация параметров для разных типов акций
        if (promotion_type === 'free_after_n_visits') {
            const visitCount = params?.visit_count;
            if (!visitCount || typeof visitCount !== 'number' || visitCount < 1) {
                return NextResponse.json({ ok: false, error: 'INVALID_VISIT_COUNT' }, { status: 400 });
            }
        }

        if (promotion_type === 'birthday_discount' || promotion_type === 'first_visit_discount') {
            const discountPercent = params?.discount_percent;
            if (!discountPercent || typeof discountPercent !== 'number' || discountPercent < 1 || discountPercent > 100) {
                return NextResponse.json({ ok: false, error: 'INVALID_DISCOUNT_PERCENT' }, { status: 400 });
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
            return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            promotion,
        });
    } catch (error) {
        logError('BranchPromotions', 'Unexpected error in POST promotions API', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

