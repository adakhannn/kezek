// apps/web/src/app/admin/api/rating-config/route.ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DAYS_BACK_MIN = 1;
const DAYS_BACK_MAX = 365;

type RatingConfigBody = {
    staff_reviews_weight?: number;
    staff_productivity_weight?: number;
    staff_loyalty_weight?: number;
    staff_discipline_weight?: number;
    window_days?: number;
    /** Если true, после сохранения конфига запускается пересчёт рейтингов за последние N дней (см. recalculate_days_back). */
    recalculate_history?: boolean;
    /** Количество дней для пересчёта (1–365). Учитывается только при recalculate_history: true. */
    recalculate_days_back?: number;
};

/**
 * GET /admin/api/rating-config
 * Получает текущую активную конфигурацию рейтинга
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
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
            return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        }
        if (!superRow) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
        }

        // Получаем активную конфигурацию
        const { data: config, error: configError } = await supabase
            .from('rating_global_config')
            .select('*')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (configError) {
            return NextResponse.json({ ok: false, error: configError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            config: config || null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

/**
 * POST /admin/api/rating-config
 * Создает новую конфигурацию рейтинга (деактивирует старую)
 */
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
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
            return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        }
        if (!superRow) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
        }

        const body = (await req.json().catch(() => ({}))) as RatingConfigBody;

        // Валидация весов (сумма должна быть близка к 100)
        const reviewsWeight = Number(body.staff_reviews_weight ?? 35);
        const productivityWeight = Number(body.staff_productivity_weight ?? 25);
        const loyaltyWeight = Number(body.staff_loyalty_weight ?? 20);
        const disciplineWeight = Number(body.staff_discipline_weight ?? 20);
        const windowDays = Number(body.window_days ?? 30);

        const totalWeight = reviewsWeight + productivityWeight + loyaltyWeight + disciplineWeight;
        if (Math.abs(totalWeight - 100) > 0.01) {
            return NextResponse.json(
                { ok: false, error: 'Sum of weights must equal 100' },
                { status: 400 }
            );
        }

        if (windowDays < 1 || windowDays > 365) {
            return NextResponse.json(
                { ok: false, error: 'Window days must be between 1 and 365' },
                { status: 400 }
            );
        }

        const admin = createClient(URL, SERVICE);

        // Деактивируем все старые конфигурации
        await admin
            .from('rating_global_config')
            .update({ is_active: false })
            .eq('is_active', true);

        // Создаем новую активную конфигурацию
        const { data: newConfig, error: insertError } = await admin
            .from('rating_global_config')
            .insert({
                staff_reviews_weight: reviewsWeight,
                staff_productivity_weight: productivityWeight,
                staff_loyalty_weight: loyaltyWeight,
                staff_discipline_weight: disciplineWeight,
                window_days: windowDays,
                is_active: true,
                valid_from: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
        }

        let recalcTriggered = false;
        let recalcError: string | null = null;

        if (body.recalculate_history === true && typeof body.recalculate_days_back === 'number') {
            const daysBack = Math.floor(body.recalculate_days_back);
            if (daysBack >= DAYS_BACK_MIN && daysBack <= DAYS_BACK_MAX) {
                const { error: recalcErr } = await admin.rpc('initialize_all_ratings', {
                    p_days_back: daysBack,
                });
                recalcTriggered = !recalcErr;
                if (recalcErr) recalcError = recalcErr.message;
            }
        }

        return NextResponse.json({
            ok: true,
            config: newConfig,
            recalculate_triggered: recalcTriggered,
            ...(recalcError != null && { recalculate_error: recalcError }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

