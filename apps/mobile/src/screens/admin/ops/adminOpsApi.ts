import { apiRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

/*
 * The website's super-admin API (apps/web/src/app/admin/api/* and /api/admin/*), called with the
 * app's Bearer token: each route checks the super-admin role itself, so a forbidden answer is an
 * error state, never empty data. One fetcher per website page; the shapes follow the routes.
 */

type Envelope<T> = { ok?: boolean; data?: T; error?: string; message?: string };

function unwrap<T>(response: Envelope<T> | null | undefined, what: string): T {
    if (!response?.ok || response.data === undefined || response.data === null) {
        throw new Error(response?.message || response?.error || `${what}: response without data`);
    }
    return response.data;
}

function query(params: Record<string, string | number | null | undefined>): string {
    const parts = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    return parts.length ? `?${parts.join('&')}` : '';
}

export type Period = { startDate: string; endDate: string };

/* ---------- /admin/analytics/overview (all businesses) ---------- */

export type GlobalOverviewSummary = {
    period: Period;
    bookings: { created: number; confirmedOrPaid: number };
    funnel: { homeViews: number; businessPageViews: number; bookingFlowStarts: number; conversionHomeToBooking: number };
    revenue: { total: number; promoBookings: number; promoRevenue: number };
};
export type GlobalOverviewDay = {
    date: string;
    homeViews: number;
    businessPageViews: number;
    bookingFlowStarts: number;
    bookingsCreated: number;
    bookingsConfirmedOrPaid: number;
    promoBookings: number;
    promoRevenue: number;
    totalRevenue: number;
};
export type GlobalOverview = { summary: GlobalOverviewSummary; byDay: GlobalOverviewDay[] };

export async function fetchGlobalOverview(period: Period): Promise<GlobalOverview> {
    const data = unwrap(await apiRequest<Envelope<GlobalOverview>>(`/admin/api/analytics/overview${query(period)}`), 'Overview');
    if (!Array.isArray(data.byDay)) throw new Error('Overview: no days');
    return data;
}

/* ---------- /admin/analytics/funnel (the current business) ---------- */

export type FunnelChannel = 'all' | 'web' | 'mobile';
export type BusinessFunnelStep = { id: string; label: string; sessions: number; conversionFromPrev: number | null };
export type BusinessFunnel = { steps: BusinessFunnelStep[]; overallConversion: number; period: Period };

export async function fetchBusinessFunnel(period: Period, channel: FunnelChannel): Promise<BusinessFunnel> {
    const data = unwrap(await apiRequest<Envelope<BusinessFunnel>>(
        `/admin/api/analytics/conversion-funnel${query({ ...period, source: channel === 'all' ? null : channel })}`,
    ), 'Funnel');
    if (!Array.isArray(data.steps)) throw new Error('Funnel: no steps');
    return data;
}

/* ---------- /admin/analytics/load (the current business) ---------- */

export type LoadPoint = {
    date: string;
    hour: number;
    bookingsCount: number;
    promoBookingsCount: number;
    staffCount?: number | null;
    uniqueClientsCount?: number | null;
};
export type BusinessLoad = { bizId?: string; branchId?: string | null; period: Period; points: LoadPoint[] };

export async function fetchBusinessLoad(period: Period, branchId: string): Promise<BusinessLoad> {
    const data = unwrap(await apiRequest<Envelope<BusinessLoad>>(
        `/admin/api/analytics/load${query({ ...period, branchId: branchId === 'all' ? null : branchId })}`,
    ), 'Load');
    if (!Array.isArray(data.points)) throw new Error('Load: no points');
    return data;
}

/* ---------- /admin/analytics/promotions (the current business) ---------- */

export type PromotionsSummary = { promoBookings: number; promoRevenue: number; totalRevenue: number };
export type PromotionsByType = { promotionType: string; bookings: number; revenue: number; discountGiven: number };
export type BusinessPromotions = { summary: PromotionsSummary; byType?: PromotionsByType[]; period: Period };

export async function fetchBusinessPromotions(period: Period, branchId: string): Promise<BusinessPromotions> {
    const data = unwrap(await apiRequest<Envelope<BusinessPromotions>>(
        `/admin/api/analytics/promotions${query({ ...period, groupBy: 'type', branchId: branchId === 'all' ? null : branchId })}`,
    ), 'Promotions');
    if (!data.summary) throw new Error('Promotions: no summary');
    return data;
}

/** The business the website's admin analytics act on (user_current_business) and its branches. */
export type CurrentBusiness = { id: string | null; name: string | null; branches: { id: string; name: string }[] };

export async function fetchCurrentBusiness(): Promise<CurrentBusiness> {
    const current = unwrap(await apiRequest<Envelope<{ currentBizId: string | null; businesses?: { id: string; name: string | null }[] }>>('/me/current-business'), 'Current business');
    const id = current.currentBizId ?? null;
    if (!id) return { id: null, name: null, branches: [] };
    let name = current.businesses?.find((business) => business.id === id)?.name ?? null;
    if (!name) {
        const { data } = await supabase.from('businesses').select('name').eq('id', id).maybeSingle();
        name = (data as { name?: string | null } | null)?.name ?? null;
    }
    let branches: { id: string; name: string }[] = [];
    try {
        const response = await apiRequest<Envelope<{ id: string; name: string }[]>>('/api/dashboard/branches/list');
        branches = response?.ok && Array.isArray(response.data) ? response.data : [];
    } catch {
        // The branch filter is optional: without it the reports cover every branch.
    }
    return { id, name, branches };
}

/* ---------- /admin/analytics/system ---------- */

export type SystemOverview = {
    summary: {
        period: Period;
        activeBusinesses: number;
        bookings: { created: number; confirmed: number };
        revenue: { total: number; avgCheck: number };
    };
    byDay: { date: string; activeBusinesses: number; bookingsConfirmed: number; totalRevenue: number }[];
};

export async function fetchSystemOverview(period: Period): Promise<SystemOverview> {
    const data = unwrap(await apiRequest<Envelope<SystemOverview>>(`/admin/api/system-analytics/overview${query(period)}`), 'System analytics');
    if (!Array.isArray(data.byDay)) throw new Error('System analytics: no days');
    return data;
}

/* ---------- /admin/funnel-analytics ---------- */

export type FunnelSource = 'all' | 'public' | 'quickdesk';
export type FunnelEventStep = { step: string; stepName: string; uniqueSessions: number; totalEvents: number; conversionRate: number };
export type FunnelEvents = {
    funnel: FunnelEventStep[];
    summary: { totalViews: number; totalBookings: number; overallConversionRate: number; totalEvents: number };
};

export async function fetchFunnelEvents(period: Partial<Period>, source: FunnelSource): Promise<FunnelEvents> {
    const data = unwrap(await apiRequest<Envelope<FunnelEvents>>(
        `/admin/api/funnel-analytics${query({ startDate: period.startDate, endDate: period.endDate, source: source === 'all' ? null : source })}`,
    ), 'Funnel analytics');
    if (!Array.isArray(data.funnel)) throw new Error('Funnel analytics: no steps');
    return data;
}

/* ---------- /admin/system-health ---------- */

export type IntegrationHealth = {
    ok: boolean;
    configured: boolean;
    providerReachable: boolean;
    providerMessage?: string;
    lastSuccessDate: string | null;
    recentFailures: number;
};
export type RatingsMetricDates = {
    ok: boolean;
    staffLastMetricDate: string | null;
    branchLastMetricDate: string | null;
    bizLastMetricDate: string | null;
    daysSinceLastMetric: number | null;
};
export type SystemHealth = {
    ok: boolean;
    timestamp: string;
    cronJobs: {
        shifts: { ok: boolean; openShiftsOlderThan2Days: number; lastCheckDate: string };
        ratings: RatingsMetricDates;
    };
    apiMetrics: {
        ok: boolean;
        totalRequests: number;
        errorRate: number;
        avgDuration: number;
        p95Duration: number;
        p99Duration: number;
        recentErrors: number;
    };
    uiErrors: { ok: boolean; recentErrors: number; lastErrorDate: string | null };
    integrations: { whatsapp: IntegrationHealth; telegram: IntegrationHealth };
};

export async function fetchSystemHealth(): Promise<SystemHealth> {
    return unwrap(await apiRequest<Envelope<SystemHealth>>('/admin/api/system-health'), 'System health');
}

/* ---------- /admin/health-check ---------- */

export type CronJobHealth = { job: string; status: string; lastSuccessAt: string | null; lastStartedAt?: string | null; runningCount?: number };
export type QueueHealth = {
    job: string;
    status: 'disabled' | 'healthy' | 'backlog' | 'failed' | string;
    counts: { due: number; failed: number; ambiguous: number; oldest_due_age_seconds: number } | null;
};
export type HealthAlert = { type: 'error' | 'warning'; message: string; details?: Record<string, unknown> };
export type HealthCheck = {
    ok: boolean;
    timestamp: string;
    alerts: HealthAlert[];
    checks: {
        cronExecutions: { ok: boolean; jobs: CronJobHealth[] };
        backgroundQueues: { ok: boolean; queues: QueueHealth[] };
        shifts: { ok: boolean; openShiftsOlderThan2Days: number; lastCheckDate: string };
        ratings: RatingsMetricDates;
        promotions: { ok: boolean; lastAppliedDate: string | null; daysSinceLastApplication: number | null; activePromotionsCount: number };
    };
};

export async function fetchHealthCheck(): Promise<HealthCheck> {
    return unwrap(await apiRequest<Envelope<HealthCheck>>('/api/admin/health-check'), 'Health check');
}

/* ---------- /admin/monitoring ---------- */

export type EndpointStats = {
    endpoint: string;
    total_requests: number;
    success_count: number;
    client_error_count: number;
    server_error_count: number;
    avg_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
    error_rate: number;
};
export type AuthFlowSnapshot = { started: number; approved: number; expired: number; failed: number; resolved: number; pending: number; approvedRate: number | null };
export type AuthFlow = {
    windowHours: number;
    current: AuthFlowSnapshot;
    previous: AuthFlowSnapshot;
    deltas: { started: number; approved: number; expired: number; failed: number; approvedRate: number | null };
};
export type MonitoringStats = { stats: EndpointStats | null; authFlow: AuthFlow | null };

/** The website's stats tab: the /api/staff/finance endpoint over the last hour and the Telegram sign-in flow over 24 h. */
export async function fetchMonitoringStats(): Promise<MonitoringStats> {
    const [stats, authFlow] = await Promise.all([
        apiRequest<Envelope<EndpointStats>>(`/admin/api/metrics/stats${query({ endpoint: '/api/staff/finance', windowMinutes: 60 })}`),
        apiRequest<Envelope<AuthFlow>>('/admin/api/metrics/auth-flow?windowHours=24'),
    ]);
    if (!stats?.ok) throw new Error(stats?.message || stats?.error || 'Stats failed');
    if (!authFlow?.ok) throw new Error(authFlow?.message || authFlow?.error || 'Auth flow failed');
    return { stats: stats.data ?? null, authFlow: authFlow.data ?? null };
}

export type ApiMetric = {
    id: string;
    endpoint: string;
    method: string;
    status_code: number;
    duration_ms: number;
    error_message?: string | null;
    error_type?: string | null;
    created_at: string;
};
export type MetricsFilters = { endpoint: string; method: string; statusCode: string; errorType: string; minDuration: string };
export const EMPTY_METRICS_FILTERS: MetricsFilters = { endpoint: '', method: '', statusCode: '', errorType: '', minDuration: '' };

export async function fetchApiMetrics(filters: MetricsFilters): Promise<ApiMetric[]> {
    const response = await apiRequest<Envelope<ApiMetric[]>>(`/admin/api/metrics${query({
        endpoint: filters.endpoint.trim(),
        method: filters.method,
        statusCode: filters.statusCode.trim(),
        errorType: filters.errorType,
        minDuration: filters.minDuration.trim(),
        limit: 50,
    })}`);
    const data = unwrap(response, 'Metrics');
    return Array.isArray(data) ? data : [];
}

export type FinanceLog = {
    id: string;
    operation_type: string;
    log_level: string;
    message: string;
    error_message?: string | null;
    created_at: string;
    staff?: { id: string; full_name: string } | null;
    business?: { id: string; name: string; slug: string } | null;
};
export type LogsFilters = { operationType: string; logLevel: string };

export async function fetchFinanceLogs(filters: LogsFilters): Promise<FinanceLog[]> {
    const response = await apiRequest<Envelope<FinanceLog[]>>(`/admin/api/finance-logs${query({
        operationType: filters.operationType,
        logLevel: filters.logLevel,
        limit: 50,
    })}`);
    const data = unwrap(response, 'Logs');
    return Array.isArray(data) ? data : [];
}

/* ---------- /admin/performance ---------- */

export type PerformanceStat = {
    source: 'server' | 'browser' | string;
    operation: string;
    unit: 'ms' | 'score';
    count: number;
    unknownCount: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
    errorRate: number;
};
export type PerformanceSnapshot = { stats: PerformanceStat[]; timestamp: number; status: 'observed' | 'no_data' };

export async function fetchPerformance(): Promise<PerformanceSnapshot> {
    const data = unwrap(await apiRequest<Envelope<PerformanceSnapshot>>('/api/admin/performance/stats'), 'Performance');
    if (!Array.isArray(data.stats) || !Number.isFinite(data.timestamp) || !['observed', 'no_data'].includes(data.status)) {
        throw new Error('Invalid performance stats response');
    }
    return data;
}

/* ---------- /admin/rating-config ---------- */

export type RatingConfig = {
    id: string;
    staff_reviews_weight: number;
    staff_productivity_weight: number;
    staff_loyalty_weight: number;
    staff_discipline_weight: number;
    window_days: number;
    is_active: boolean;
    valid_from: string;
};
export type RatingWeights = { reviews: number; productivity: number; loyalty: number; discipline: number; windowDays: number };

export async function fetchRatingConfig(): Promise<RatingConfig | null> {
    const response = await apiRequest<{ ok?: boolean; config?: RatingConfig | null; error?: string }>('/admin/api/rating-config');
    if (!response?.ok) throw new Error(response?.error || 'Rating config failed');
    return response.config ?? null;
}

export async function saveRatingConfig(weights: RatingWeights): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; error?: string }>('/admin/api/rating-config', {
        method: 'POST',
        body: JSON.stringify({
            staff_reviews_weight: weights.reviews,
            staff_productivity_weight: weights.productivity,
            staff_loyalty_weight: weights.loyalty,
            staff_discipline_weight: weights.discipline,
            window_days: weights.windowDays,
        }),
    });
    if (!response?.ok) throw new Error(response?.error || 'Save failed');
}

/** POST /api/admin/initialize-ratings: recalculates the ratings of the last `daysBack` days. */
export async function initializeRatings(daysBack: number): Promise<void> {
    const response = await apiRequest<Envelope<unknown>>('/api/admin/initialize-ratings', {
        method: 'POST',
        body: JSON.stringify({ days_back: daysBack }),
    });
    if (!response?.ok) throw new Error(response?.message || response?.error || 'Recalculation failed');
}

/* ---------- /admin/ratings-status ---------- */

export type RatingsStatus = {
    staff_last_metric_date: string | null;
    branch_last_metric_date: string | null;
    biz_last_metric_date: string | null;
    staff_last_rating_recalculated_at: string | null;
    branch_last_rating_recalculated_at: string | null;
    biz_last_rating_recalculated_at: string | null;
    staff_without_rating: number | null;
    branches_without_rating: number | null;
    businesses_without_rating: number | null;
    recent_errors_total?: number;
    recent_errors_days?: number;
    has_recent_errors?: boolean;
};
export type RatingJob = {
    id: string;
    created_at: string;
    date_from: string;
    date_to: string;
    scope: string;
    status: string;
    processed_days: number;
    total_days: number;
    error_message: string | null;
};

export async function fetchRatingsStatus(): Promise<{ status: RatingsStatus; jobs: RatingJob[] | null }> {
    const [status, jobs] = await Promise.all([
        apiRequest<Envelope<RatingsStatus>>('/api/admin/ratings/status'),
        // As on the website, a failed jobs read hides the jobs block, not the whole page.
        apiRequest<Envelope<{ jobs: RatingJob[] }>>('/api/admin/ratings/jobs').catch(() => null),
    ]);
    return {
        status: unwrap(status, 'Ratings status'),
        jobs: jobs?.ok && Array.isArray(jobs.data?.jobs) ? jobs.data.jobs : null,
    };
}

/* ---------- /admin/ratings-debug ---------- */

export type DebugEntityType = 'staff' | 'branch' | 'biz';
export type RatingsDebug = {
    days: number;
    window_since: string;
    with_null_rating: {
        staff: { id: string; full_name: string | null; biz_id: string; branch_id: string; last_rating_recalculated_at: string | null }[];
        branches: { id: string; name: string; biz_id: string; last_rating_recalculated_at: string | null }[];
        businesses: { id: string; name: string | null; slug: string | null; last_rating_recalculated_at: string | null }[];
    };
    without_metrics_since: {
        staff: { id: string; full_name: string | null; biz_id: string; branch_id: string }[];
        branches: { id: string; name: string; biz_id: string }[];
        businesses: { id: string; name: string | null; slug: string | null }[];
        total_count: { staff: number; branches: number; businesses: number };
    };
    recent_errors: { id: string; entity_id: string; entity_type: string; metric_date: string; error_message: string; created_at: string }[];
};

export async function fetchRatingsDebug(days: number): Promise<RatingsDebug> {
    return unwrap(await apiRequest<Envelope<RatingsDebug>>(`/api/admin/ratings/debug-entities?days=${days}`), 'Ratings debug');
}

export async function recalculateRating(entityType: DebugEntityType, entityId: string): Promise<void> {
    const response = await apiRequest<Envelope<unknown>>('/api/admin/ratings/recalculate', {
        method: 'POST',
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
    });
    if (!response?.ok) throw new Error(response?.message || response?.error || 'Recalculation failed');
}

/* ---------- /admin/promotions-debug ---------- */

export type PromotionsDebug = {
    client?: { id: string; email?: string; phone?: string; name?: string };
    branch?: { id: string; name: string; biz_id: string };
    biz?: { id: string; name: string; slug: string };
    promotionUsage: {
        id: string;
        promotion_id: string;
        promotion_type: string;
        booking_id: string | null;
        used_at: string;
        usage_data: unknown;
        promotion?: { title_ru: string; promotion_type: string; params: unknown };
        booking?: { id: string; status: string };
    }[];
    referrals: {
        id: string;
        referrer_id: string;
        referred_id: string;
        referrer_bonus_used: boolean;
        created_at: string;
        referrer?: { email?: string; phone?: string };
        referred?: { email?: string; phone?: string };
    }[];
    bookings: { id: string; start_at: string; status: string; promotion_applied: unknown; service?: { name_ru: string } }[];
    activePromotions: { id: string; title_ru: string; promotion_type: string; params: unknown; is_active: boolean }[];
    anomalies: { type: string; message: string; severity: 'warning' | 'error'; data?: unknown }[];
};
export type PromotionsDebugIds = { clientId: string; branchId: string; bizId: string };

export async function fetchPromotionsDebug(ids: PromotionsDebugIds): Promise<PromotionsDebug> {
    const data = unwrap(await apiRequest<Envelope<PromotionsDebug>>(`/api/admin/promotions/debug${query({
        clientId: ids.clientId.trim(),
        branchId: ids.branchId.trim(),
        bizId: ids.bizId.trim(),
    })}`), 'Promotions debug');
    return {
        ...data,
        promotionUsage: data.promotionUsage ?? [],
        referrals: data.referrals ?? [],
        bookings: data.bookings ?? [],
        activePromotions: data.activePromotions ?? [],
        anomalies: data.anomalies ?? [],
    };
}
