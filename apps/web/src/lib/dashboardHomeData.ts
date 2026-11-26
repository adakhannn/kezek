import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { loadStaffApplicationSummary, type StaffApplicationSummary } from '@/lib/staffApplicationSummary';
import { getBusinessTimezone } from '@/lib/time';

type BizContext = Awaited<ReturnType<typeof getBizContextForManagers>>;
type SupabaseServerClient = BizContext['supabase'];
type FilterValue = string | number | boolean | null;

export type DashboardRatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

/** What the business dashboard home (/dashboard) shows; the mobile app reads the same object. */
export type DashboardHomeData = {
    staffApplications: StaffApplicationSummary;
    bizName: string | null;
    bizCity: string | null;
    /** The moment the numbers were read (ISO); the client formats it in its locale. */
    formattedDate: string;
    /** businesses.tz, resolved (Asia/Bishkek when missing). */
    timezone: string;
    bookingsToday: number;
    staffActive: number;
    servicesActive: number;
    branchesCount: number;
    needOnboarding: boolean;
    ratingScore: number | null;
    ratingConfigScope: 'biz' | 'global' | null;
    ratingWeights: DashboardRatingWeights | null;
};

type RatingConfigRow = {
    staff_reviews_weight: number;
    staff_productivity_weight: number;
    staff_loyalty_weight: number;
    staff_discipline_weight: number;
    window_days: number;
};

async function count(
    supabase: SupabaseServerClient,
    table: 'staff' | 'services' | 'branches',
    filters: { col: string; eq?: FilterValue }[] = [],
): Promise<number | null> {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const f of filters) {
        if (f.eq !== undefined && f.eq !== null) q = q.eq(f.col, f.eq);
    }
    const { count: c, error } = await q;
    // FE-08: a failed count is unknown, not 0 (zeros would also trigger the onboarding card).
    if (error) {
        logError('DashboardHome', 'Failed to count dashboard records', { table, error });
        return null;
    }
    return c ?? 0;
}

/**
 * The numbers of the business dashboard home: bookings today (business day), active staff,
 * services and branches, the rating formula and the pending staff applications (owner only).
 * `null` when a count failed (FE-08): the caller shows a load error, never zeros.
 */
export async function loadDashboardHomeData(
    ctx: Pick<BizContext, 'supabase' | 'bizId' | 'business' | 'userId'>,
    now: Date = new Date(),
): Promise<DashboardHomeData | null> {
    const { supabase, bizId, business, userId } = ctx;

    const [
        [staffActive, servicesActive, branchesCount],
        { data: ratingConfig },
        { data: bizRatingConfig },
        staffApplications,
    ] = await Promise.all([
        Promise.all([
            count(supabase, 'staff', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
            count(supabase, 'services', [{ col: 'biz_id', eq: bizId }, { col: 'active', eq: true }]),
            count(supabase, 'branches', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
        ]),
        supabase
            .from('rating_global_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle<RatingConfigRow>(),
        supabase
            .from('rating_biz_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle<RatingConfigRow>(),
        loadStaffApplicationSummary(userId, bizId),
    ]);

    const biz = business as (typeof business & { city?: string | null }) | null;

    // "Today" is the business day in the business time zone.
    const businessTz = getBusinessTimezone(biz?.tz);
    const todayStr = formatInTimeZone(now, businessTz, 'yyyy-MM-dd');
    const start = fromZonedTime(`${todayStr}T00:00:00`, businessTz).toISOString();
    const end = fromZonedTime(`${todayStr}T23:59:59.999`, businessTz).toISOString();

    const { count: bookingsTodayCount, error: bookingsTodayError } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .gte('start_at', start)
        .lte('start_at', end);
    if (bookingsTodayError) {
        logError('DashboardHome', 'Failed to count today bookings', { bizId, error: bookingsTodayError });
    }
    if (bookingsTodayError || staffActive === null || servicesActive === null || branchesCount === null) {
        return null;
    }
    const bookingsToday = bookingsTodayCount ?? 0;

    const effectiveRatingConfig = bizRatingConfig ?? ratingConfig;

    return {
        staffApplications,
        bizName: biz?.name || null,
        bizCity: biz?.city || null,
        formattedDate: now.toISOString(),
        timezone: businessTz,
        bookingsToday,
        staffActive,
        servicesActive,
        branchesCount,
        needOnboarding: bookingsToday === 0 || staffActive === 0 || servicesActive === 0 || branchesCount === 0,
        ratingScore: biz?.rating_score ?? null,
        ratingConfigScope: effectiveRatingConfig ? (bizRatingConfig ? 'biz' : 'global') : null,
        ratingWeights: effectiveRatingConfig
            ? {
                  reviews: Number(effectiveRatingConfig.staff_reviews_weight),
                  productivity: Number(effectiveRatingConfig.staff_productivity_weight),
                  loyalty: Number(effectiveRatingConfig.staff_loyalty_weight),
                  discipline: Number(effectiveRatingConfig.staff_discipline_weight),
                  windowDays: Number(effectiveRatingConfig.window_days),
              }
            : null,
    };
}
