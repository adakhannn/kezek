/**
 * Общие TS-хелперы для рейтингов.
 *
 * Цели:
 * - Явно зафиксировать семантику rating_score:
 *   - NULL  → рейтинг ещё ни разу не был рассчитан.
 *   - 50.0  → дефолтный стартовый рейтинг.
 *   - 0–100 → честное числовое значение рейтинга.
 * - Описать инварианты скользящего окна (window_days), используемого в SQL:
 *   - окно [today - window_days, today), текущий день не входит;
 *   - метрики считаются по активным дням (для staff_day_metrics — только дни с активностью).
 * - Минимизировать дублирование этой логики по API-роутам и UI.
 */

export type RatingScoreRaw = number | null;

export type RatingScoreKind = 'uninitialized' | 'default' | 'value';

export type RatingSemantics = {
    kind: RatingScoreKind;
    value: number | null;
};

const DEFAULT_RATING = 50;
const MIN_RATING = 0;
const MAX_RATING = 100;
const EPS = 0.0001;

/**
 * Интерпретирует "сырое" значение rating_score из БД с учётом семантики NULL / 50 / 0–100.
 */
export function interpretRatingScore(raw: RatingScoreRaw): RatingSemantics {
    if (raw === null || Number.isNaN(raw as number)) {
        return { kind: 'uninitialized', value: null };
    }

    const clamped = clampRating(raw);

    if (Math.abs(clamped - DEFAULT_RATING) < EPS) {
        return { kind: 'default', value: clamped };
    }

    return { kind: 'value', value: clamped };
}

/**
 * Явно проверяет, что рейтинг ещё не инициализирован (NULL в БД).
 */
export function isRatingUninitialized(raw: RatingScoreRaw): boolean {
    return interpretRatingScore(raw).kind === 'uninitialized';
}

/**
 * Проверяет, что значение является "дефолтным стартовым" рейтингом (около 50).
 */
export function isDefaultRating(raw: RatingScoreRaw): boolean {
    return interpretRatingScore(raw).kind === 'default';
}

/**
 * Ограничивает рейтинг в диапазоне 0–100.
 */
export function clampRating(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_RATING;
    if (value < MIN_RATING) return MIN_RATING;
    if (value > MAX_RATING) return MAX_RATING;
    return value;
}

/**
 * Семантика скользящего окна рейтинга.
 *
 * В SQL (calculate_*_rating) используется окно:
 *  - metric_date >= current_date - window_days
 *  - metric_date < current_date
 * То есть текущий день НЕ входит в окно, только последние N полных дней.
 */
export type RatingWindow = {
    /** Начало окна (включительно), в формате YYYY-MM-DD */
    startDate: string;
    /** Конец окна (исключительно), в формате YYYY-MM-DD — обычно "сегодня" в UTC */
    endDateExclusive: string;
};

export function getRatingWindow(windowDays: number, today: Date = new Date()): RatingWindow {
    const days = Math.max(1, Math.min(365, windowDays || DEFAULT_RATING)); // 50 здесь не критично, но защищает от 0/NaN

    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);

    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

    return {
        startDate: toIsoDate(start),
        endDateExclusive: toIsoDate(end),
    };
}

/**
 * Проверяет, попадает ли указанная дата в окно рейтинга.
 * Ожидает ISO-дату YYYY-MM-DD или Date.
 */
export function isDateInRatingWindow(
    date: string | Date,
    windowDays: number,
    today: Date = new Date()
): boolean {
    const { startDate, endDateExclusive } = getRatingWindow(windowDays, today);
    const value = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    return value >= startDate && value < endDateExclusive;
}

/**
 * Хелпер для "активного дня" на уровне сотрудника.
 * В SQL день считается неактивным и не пишет запись в staff_day_metrics, если:
 *  - total_shifts = 0
 *  - clients_count = 0
 *  - reviews_count = 0
 */
export type StaffDayActivityLike = {
    total_shifts: number;
    clients_count: number;
    reviews_count: number;
};

export function isActiveStaffDay(metrics: StaffDayActivityLike): boolean {
    return (
        (metrics.total_shifts ?? 0) > 0 ||
        (metrics.clients_count ?? 0) > 0 ||
        (metrics.reviews_count ?? 0) > 0
    );
}

