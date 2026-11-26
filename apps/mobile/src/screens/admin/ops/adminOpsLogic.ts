import type { Tone } from '../../../constants/theme';
import { addDaysToDate } from '../../manage/opsKit/dates';
import type { LoadPoint, PromotionsByType, RatingConfig, RatingWeights } from './adminOpsApi';

/*
 * The rules of the website's admin pages, kept apart from the screens so they are tested once:
 * periods, the occupancy heatmap, promotion sorting, performance thresholds, status tones and the
 * rating weights form.
 */

/** The platform's time zone: the website's admin pages count "today" in it (lib/time TZ). */
export const ADMIN_TZ = 'Asia/Bishkek';

export type PeriodPreset = '7' | '30' | '90' | 'custom';
export const PERIOD_PRESETS: readonly PeriodPreset[] = ['7', '30', '90', 'custom'];

/** The website admin rule: a preset of N days ends today and starts N days before it. */
export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, today: string): { startDate: string; endDate: string } {
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
    return { startDate: addDaysToDate(today, -days), endDate: today };
}

/** Two decimals, as the website rounds every share (Math.round(x * 100 + EPSILON) / 100). */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `part` of `total` in percent with two decimals; 0 when either is not positive. */
export function percentOf(part: number, total: number): number {
    return total > 0 && part > 0 ? round2((part / total) * 100) : 0;
}

/* ---------- occupancy heatmap (/admin/analytics/load) ---------- */

export type HeatmapMode = 'byDate' | 'byWeekday';
export type HeatmapRow = {
    /** The date (YYYY-MM-DD) or the weekday number ('0' = Sunday). */
    key: string;
    /** Bookings (by date) or the average per day (by weekday) of each hour 0-23. */
    cells: number[];
    total: number;
    /** The busiest hour, null when the row is empty. */
    peakHour: number | null;
};

/** Monday first, as on the website. */
export const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

function weekdayOf(date: string): number {
    return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function finishRow(key: string, cells: number[]): HeatmapRow {
    const total = cells.reduce((sum, value) => sum + value, 0);
    let peakHour: number | null = null;
    cells.forEach((value, hour) => {
        if (value > 0 && (peakHour === null || value > cells[peakHour])) peakHour = hour;
    });
    return { key, cells, total, peakHour };
}

/**
 * The website's heatmap: by date, the bookings of every date and hour; by weekday, the bookings of
 * a weekday and hour divided by the number of dates of that weekday in the data.
 */
export function buildHeatmap(points: readonly LoadPoint[], mode: HeatmapMode): { rows: HeatmapRow[]; max: number } {
    const rows = new Map<string, number[]>();
    const datesByWeekday = new Map<string, Set<string>>();
    for (const point of points) {
        if (!Number.isInteger(point.hour) || point.hour < 0 || point.hour > 23) continue;
        const key = mode === 'byDate' ? point.date : String(weekdayOf(point.date));
        const cells = rows.get(key) ?? Array.from({ length: 24 }, () => 0);
        cells[point.hour] += point.bookingsCount;
        rows.set(key, cells);
        if (mode === 'byWeekday') {
            const dates = datesByWeekday.get(key) ?? new Set<string>();
            dates.add(point.date);
            datesByWeekday.set(key, dates);
        }
    }
    const keys = [...rows.keys()].sort((a, b) => mode === 'byDate'
        ? a.localeCompare(b)
        : WEEKDAY_ORDER.indexOf(a as typeof WEEKDAY_ORDER[number]) - WEEKDAY_ORDER.indexOf(b as typeof WEEKDAY_ORDER[number]));
    const result = keys.map((key) => {
        const cells = rows.get(key) ?? [];
        const days = mode === 'byWeekday' ? datesByWeekday.get(key)?.size ?? 1 : 1;
        return finishRow(key, days > 1 ? cells.map((value) => value / days) : cells);
    });
    const max = result.reduce((top, row) => Math.max(top, ...row.cells), 0);
    return { rows: result, max };
}

/** The bookings of each hour 0-23 over the whole period. */
export function bookingsByHour(points: readonly LoadPoint[]): number[] {
    const hours = Array.from({ length: 24 }, () => 0);
    for (const point of points) {
        if (Number.isInteger(point.hour) && point.hour >= 0 && point.hour <= 23) hours[point.hour] += point.bookingsCount;
    }
    return hours;
}

/** The website's five colour steps of a heatmap cell (0 = empty, 5 = above 80% of the maximum). */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 {
    if (max <= 0 || value <= 0) return 0;
    const ratio = Math.min(value / max, 1);
    if (ratio > 0.8) return 5;
    if (ratio > 0.6) return 4;
    if (ratio > 0.4) return 3;
    if (ratio > 0.2) return 2;
    return 1;
}

/* ---------- promotions by type (/admin/analytics/promotions) ---------- */

export type PromoSortKey = 'revenue' | 'bookings' | 'discount' | 'type';
export type SortDir = 'asc' | 'desc';

/** The website's table: filtered by type, sorted by a column; the type sorts by name. */
export function sortPromotions(rows: readonly PromotionsByType[], typeFilter: string, key: PromoSortKey, dir: SortDir): PromotionsByType[] {
    const filtered = typeFilter === 'all' ? [...rows] : rows.filter((row) => row.promotionType === typeFilter);
    const sign = dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
        if (key === 'type') return sign * a.promotionType.localeCompare(b.promotionType);
        const value = (row: PromotionsByType) => key === 'bookings' ? row.bookings : key === 'discount' ? row.discountGiven : row.revenue;
        return sign * (value(a) - value(b));
    });
}

/** A new sort column starts descending (names ascending); the same column flips the direction. */
export function nextSort(current: { key: PromoSortKey; dir: SortDir }, key: PromoSortKey): { key: PromoSortKey; dir: SortDir } {
    if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    return { key, dir: key === 'type' ? 'asc' : 'desc' };
}

/* ---------- durations, statuses and tones ---------- */

/** "850ms" under a second, "1.25s" above, as on the website's monitoring pages. */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/** A performance value: a CLS score with three decimals, else a duration. */
export function formatPerfValue(value: number, unit: 'ms' | 'score'): string {
    return unit === 'score' ? value.toFixed(3) : formatDuration(value);
}

const PERF_THRESHOLDS: Record<string, { warn: number; error: number }> = {
    get_free_slots_service_day_v2: { warn: 2000, error: 5000 },
    get_free_slots_complex_day_v1: { warn: 2000, error: 5000 },
    get_free_slots_page_v1: { warn: 2000, error: 5000 },
    CLS: { warn: 0.1, error: 0.25 },
    shift_close: { warn: 3000, error: 10000 },
    shift_close_dashboard: { warn: 3000, error: 10000 },
    apply_promotion: { warn: 1000, error: 3000 },
    recalculate_ratings: { warn: 30000, error: 60000 },
};

/** The website's thresholds of an operation: neutral when it has none. */
export function perfTone(operation: string, value: number): Tone {
    const threshold = PERF_THRESHOLDS[operation];
    if (!threshold) return 'neutral';
    if (value >= threshold.error) return 'danger';
    if (value >= threshold.warn) return 'warning';
    return 'success';
}

/** Conversion colours of the website's funnel page: 50% green, 30% blue, 10% amber, else red. */
export function conversionTone(rate: number): Tone {
    if (rate >= 50) return 'success';
    if (rate >= 30) return 'info';
    if (rate >= 10) return 'warning';
    return 'danger';
}

export function httpStatusTone(code: number): Tone {
    if (code >= 500) return 'danger';
    if (code >= 400) return 'warning';
    return 'success';
}

export function logLevelTone(level: string): Tone {
    if (level === 'error') return 'danger';
    if (level === 'warn' || level === 'warning') return 'warning';
    return 'info';
}

export function cronTone(status: string): Tone {
    if (status === 'healthy') return 'success';
    if (status === 'running') return 'info';
    if (status === 'disabled') return 'neutral';
    if (status === 'unobserved' || status === 'overdue') return 'warning';
    return 'danger';
}

export function queueTone(status: string): Tone {
    if (status === 'healthy') return 'success';
    if (status === 'disabled') return 'neutral';
    if (status === 'backlog') return 'warning';
    return 'danger';
}

export function jobTone(status: string): Tone {
    if (status === 'success') return 'success';
    if (status === 'running') return 'info';
    if (status === 'queued') return 'neutral';
    return 'danger';
}

/** "+3" / "-2" / "+0" for a change between two windows. */
export function signed(value: number): string {
    return `${value >= 0 ? '+' : ''}${value}`;
}

/** A 0..1 ratio in percent with one decimal ('-' without a value), as the auth-flow block shows it. */
export function ratioPercent(value: number | null): string {
    return value === null || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(1)}%`;
}

/** The website's ratings-status rule: no date, or a date more than `maxDays` ago, is stale. */
export function isStale(value: string | null | undefined, now: Date = new Date(), maxDays = 2): boolean {
    if (!value) return true;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return true;
    return (now.getTime() - time) / 86_400_000 > maxDays;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
    return UUID.test(value.trim());
}

/** Pretty JSON of a debug value, or null when there is nothing to show. */
export function prettyJson(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

/* ---------- rating weights (/admin/rating-config) ---------- */

/** The website's defaults when no configuration is active. */
export const DEFAULT_RATING_WEIGHTS: RatingWeights = { reviews: 35, productivity: 25, loyalty: 20, discipline: 20, windowDays: 30 };

export function weightsFromConfig(config: RatingConfig | null): RatingWeights {
    if (!config) return DEFAULT_RATING_WEIGHTS;
    return {
        reviews: Number(config.staff_reviews_weight ?? DEFAULT_RATING_WEIGHTS.reviews),
        productivity: Number(config.staff_productivity_weight ?? DEFAULT_RATING_WEIGHTS.productivity),
        loyalty: Number(config.staff_loyalty_weight ?? DEFAULT_RATING_WEIGHTS.loyalty),
        discipline: Number(config.staff_discipline_weight ?? DEFAULT_RATING_WEIGHTS.discipline),
        windowDays: Number(config.window_days ?? DEFAULT_RATING_WEIGHTS.windowDays),
    };
}

export function weightsSum(weights: RatingWeights): number {
    return weights.reviews + weights.productivity + weights.loyalty + weights.discipline;
}

export function weightsSumOk(weights: RatingWeights): boolean {
    return Math.abs(weightsSum(weights) - 100) < 0.01;
}

export function windowDaysOk(days: number): boolean {
    return Number.isInteger(days) && days >= 1 && days <= 365;
}

/** The website saves only when the weights add up to 100 and the window is 1..365 days. */
export function weightsValid(weights: RatingWeights): boolean {
    const parts = [weights.reviews, weights.productivity, weights.loyalty, weights.discipline];
    return parts.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) && weightsSumOk(weights) && windowDaysOk(weights.windowDays);
}

export function weightsChanged(a: RatingWeights, b: RatingWeights): boolean {
    return a.reviews !== b.reviews || a.productivity !== b.productivity || a.loyalty !== b.loyalty
        || a.discipline !== b.discipline || a.windowDays !== b.windowDays;
}

/** A typed weight: digits (and one decimal mark) to a number, empty to NaN. */
export function parseNumberInput(text: string): number {
    const normalized = text.replace(',', '.').trim();
    if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
    return Number(normalized);
}

/** The website's history recalculation choices after a change of the weights. */
export const RECALC_DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;

/** The website's "days without metrics" choices of the ratings debug page. */
export const DEBUG_DAYS_OPTIONS = [1, 3, 7, 14, 30, 90] as const;
