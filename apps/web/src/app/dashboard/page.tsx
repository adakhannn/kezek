import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { DashboardHomeClient } from './components/DashboardHomeClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getBusinessTimezone } from '@/lib/time';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FilterValue = string | number | boolean | null;

// Используем более гибкий тип для Supabase клиента из SSR
// createServerClient возвращает SupabaseClient с правильной типизацией
type SupabaseServerClient = Awaited<ReturnType<typeof getBizContextForManagers>>['supabase'];

async function count(
    supabase: SupabaseServerClient,
    table: string,
    filters: { col: string; eq?: FilterValue; gte?: FilterValue; lte?: FilterValue }[] = []
): Promise<number> {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const f of filters) {
        if (f.eq !== undefined && f.eq !== null) q = q.eq(f.col, f.eq);
        if (f.gte !== undefined && f.gte !== null) q = q.gte(f.col, f.gte);
        if (f.lte !== undefined && f.lte !== null) q = q.lte(f.col, f.lte);
    }
    const { count: c } = await q;
    return c ?? 0;
}

export default async function DashboardHome() {
    const { supabase, bizId } = await getBizContextForManagers();

    const [
        [, staffActive, servicesActive, branchesCount],
        { data: biz },
        { data: ratingConfig },
    ] = await Promise.all([
        Promise.all([
            // bookingsToday будет пересчитан после получения таймзоны бизнеса
            Promise.resolve(0),
            count(supabase, 'staff', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
            count(supabase, 'services', [{ col: 'biz_id', eq: bizId }, { col: 'active', eq: true }]),
            count(supabase, 'branches', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
        ]),
        supabase
            .from('businesses')
            .select('name, city, slug, rating_score, tz')
            .eq('id', bizId)
            .maybeSingle<{ name: string | null; city: string | null; slug: string | null; rating_score: number | null; tz: string | null }>(),
        supabase
            .from('rating_global_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle<{
                staff_reviews_weight: number;
                staff_productivity_weight: number;
                staff_loyalty_weight: number;
                staff_discipline_weight: number;
                window_days: number;
            }>(),
    ]);

    // Используем таймзону бизнеса для расчета диапазона "сегодня"
    const businessTz = getBusinessTimezone(biz?.tz);
    const now = new Date();
    const todayStr = formatInTimeZone(now, businessTz, 'yyyy-MM-dd');
    // Начало дня в таймзоне бизнеса
    const startOfDay = fromZonedTime(`${todayStr}T00:00:00`, businessTz);
    // Конец дня в таймзоне бизнеса
    const endOfDay = fromZonedTime(`${todayStr}T23:59:59.999`, businessTz);
    const start = startOfDay.toISOString();
    const end = endOfDay.toISOString();

    // Пересчитываем bookingsToday с правильным диапазоном дат
    const { count: bookingsTodayCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .gte('start_at', start)
        .lte('start_at', end);
    const bookingsToday = bookingsTodayCount ?? 0;

    const bizName = biz?.name || null; // Передаем null, чтобы перевести на клиенте
    const bizCity = biz?.city || null;
    const bizRatingScore = biz?.rating_score ?? null;

    // Передаем ISO строку, форматирование будет на клиенте с учетом локали
    const formattedDate = now.toISOString();

    const needOnboarding =
        bookingsToday === 0 || staffActive === 0 || servicesActive === 0 || branchesCount === 0;

    return (
        <DashboardHomeClient
            bizName={bizName}
            bizCity={bizCity}
            formattedDate={formattedDate}
            bookingsToday={bookingsToday}
            staffActive={staffActive}
            servicesActive={servicesActive}
            branchesCount={branchesCount}
            needOnboarding={needOnboarding}
            ratingScore={bizRatingScore}
            ratingWeights={
                ratingConfig
                    ? {
                          reviews: Number(ratingConfig.staff_reviews_weight),
                          productivity: Number(ratingConfig.staff_productivity_weight),
                          loyalty: Number(ratingConfig.staff_loyalty_weight),
                          discipline: Number(ratingConfig.staff_discipline_weight),
                          windowDays: Number(ratingConfig.window_days),
                      }
                    : null
            }
        />
    );
}
