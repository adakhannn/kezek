import { ADMIN_MENU } from '../../../screens/admin/adminMenu';
import {
    bookingsByHour,
    buildHeatmap,
    conversionTone,
    cronTone,
    DEFAULT_RATING_WEIGHTS,
    formatDuration,
    formatPerfValue,
    heatLevel,
    isStale,
    isUuid,
    nextSort,
    parseNumberInput,
    percentOf,
    perfTone,
    presetPeriod,
    queueTone,
    ratioPercent,
    signed,
    sortPromotions,
    weightsChanged,
    weightsFromConfig,
    weightsValid,
} from '../../../screens/admin/ops/adminOpsLogic';

const point = (date: string, hour: number, bookingsCount: number) => ({ date, hour, bookingsCount, promoBookingsCount: 0 });

describe('admin ops logic', () => {
    test('a preset ends today and starts N days before, as on the website', () => {
        expect(presetPeriod('7', '2026-11-26')).toEqual({ startDate: '2026-11-19', endDate: '2026-11-26' });
        expect(presetPeriod('30', '2026-03-01')).toEqual({ startDate: '2026-01-30', endDate: '2026-03-01' });
    });

    test('shares round to two decimals and are zero without a positive total', () => {
        expect(percentOf(1, 3)).toBe(33.33);
        expect(percentOf(5, 0)).toBe(0);
        expect(percentOf(0, 10)).toBe(0);
    });

    test('the heatmap by date sums bookings per date and hour and finds the peak', () => {
        const { rows, max } = buildHeatmap([
            point('2026-11-26', 10, 2),
            point('2026-11-25', 9, 1),
            point('2026-11-26', 10, 1),
            point('2026-11-26', 14, 1),
        ], 'byDate');
        expect(rows.map((row) => row.key)).toEqual(['2026-11-25', '2026-11-26']);
        expect(rows[1].cells[10]).toBe(3);
        expect(rows[1].total).toBe(4);
        expect(rows[1].peakHour).toBe(10);
        expect(max).toBe(3);
    });

    test('the heatmap by weekday averages over the dates of a weekday, Monday first', () => {
        // 2026-11-23 and 2026-11-30 are Mondays, 2026-11-29 is a Sunday.
        const { rows } = buildHeatmap([
            point('2026-11-23', 9, 2),
            point('2026-11-30', 9, 4),
            point('2026-11-29', 12, 1),
        ], 'byWeekday');
        expect(rows.map((row) => row.key)).toEqual(['1', '0']);
        expect(rows[0].cells[9]).toBe(3);
        expect(rows[1].cells[12]).toBe(1);
    });

    test('hour totals and the five colour steps', () => {
        expect(bookingsByHour([point('2026-11-26', 10, 2), point('2026-11-25', 10, 3), point('2026-11-25', 30, 9)])[10]).toBe(5);
        expect(heatLevel(0, 10)).toBe(0);
        expect(heatLevel(1, 10)).toBe(1);
        expect(heatLevel(5, 10)).toBe(3);
        expect(heatLevel(10, 10)).toBe(5);
        expect(heatLevel(3, 0)).toBe(0);
    });

    test('promotions filter by type and sort; a new column starts descending, the same one flips', () => {
        const rows = [
            { promotionType: 'birthday', bookings: 2, revenue: 500, discountGiven: 50 },
            { promotionType: 'referral', bookings: 5, revenue: 300, discountGiven: 90 },
            { promotionType: 'first_visit', bookings: 1, revenue: 900, discountGiven: 10 },
        ];
        expect(sortPromotions(rows, 'all', 'revenue', 'desc').map((row) => row.promotionType)).toEqual(['first_visit', 'birthday', 'referral']);
        expect(sortPromotions(rows, 'all', 'type', 'asc').map((row) => row.promotionType)).toEqual(['birthday', 'first_visit', 'referral']);
        expect(sortPromotions(rows, 'referral', 'bookings', 'desc')).toHaveLength(1);
        expect(nextSort({ key: 'revenue', dir: 'desc' }, 'revenue')).toEqual({ key: 'revenue', dir: 'asc' });
        expect(nextSort({ key: 'revenue', dir: 'desc' }, 'type')).toEqual({ key: 'type', dir: 'asc' });
        expect(nextSort({ key: 'type', dir: 'asc' }, 'discount')).toEqual({ key: 'discount', dir: 'desc' });
    });

    test('durations, performance thresholds and tones follow the website', () => {
        expect(formatDuration(850.4)).toBe('850ms');
        expect(formatDuration(1250)).toBe('1.25s');
        expect(formatPerfValue(0.12345, 'score')).toBe('0.123');
        expect(perfTone('apply_promotion', 500)).toBe('success');
        expect(perfTone('apply_promotion', 1500)).toBe('warning');
        expect(perfTone('apply_promotion', 3000)).toBe('danger');
        expect(perfTone('unknown_op', 99999)).toBe('neutral');
        expect(conversionTone(55)).toBe('success');
        expect(conversionTone(35)).toBe('info');
        expect(conversionTone(12)).toBe('warning');
        expect(conversionTone(2)).toBe('danger');
        expect(cronTone('healthy')).toBe('success');
        expect(cronTone('stuck')).toBe('danger');
        expect(queueTone('backlog')).toBe('warning');
        expect(signed(3)).toBe('+3');
        expect(signed(-2)).toBe('-2');
        expect(ratioPercent(0.5)).toBe('50.0%');
        expect(ratioPercent(null)).toBe('-');
    });

    test('a metric date is stale without a value or after two days', () => {
        const now = new Date('2026-11-26T12:00:00Z');
        expect(isStale(null, now)).toBe(true);
        expect(isStale('2026-11-25', now)).toBe(false);
        expect(isStale('2026-11-23', now)).toBe(true);
        expect(isStale('garbage', now)).toBe(true);
    });

    test('rating weights: defaults, the sum of 100, the 1..365 window and changes', () => {
        expect(weightsFromConfig(null)).toEqual(DEFAULT_RATING_WEIGHTS);
        expect(weightsValid(DEFAULT_RATING_WEIGHTS)).toBe(true);
        expect(weightsValid({ ...DEFAULT_RATING_WEIGHTS, reviews: 40 })).toBe(false);
        expect(weightsValid({ ...DEFAULT_RATING_WEIGHTS, windowDays: 0 })).toBe(false);
        expect(weightsValid({ ...DEFAULT_RATING_WEIGHTS, windowDays: 366 })).toBe(false);
        expect(weightsValid({ ...DEFAULT_RATING_WEIGHTS, reviews: Number.NaN })).toBe(false);
        expect(weightsChanged(DEFAULT_RATING_WEIGHTS, { ...DEFAULT_RATING_WEIGHTS })).toBe(false);
        expect(weightsChanged(DEFAULT_RATING_WEIGHTS, { ...DEFAULT_RATING_WEIGHTS, windowDays: 14 })).toBe(true);
        expect(parseNumberInput('12,5')).toBe(12.5);
        expect(Number.isNaN(parseNumberInput(''))).toBe(true);
    });

    test('ids are checked as UUIDs', () => {
        expect(isUuid('7b0d2a4e-1c2f-4a7e-9a3b-1d2e3f4a5b6c')).toBe(true);
        expect(isUuid('not-a-uuid')).toBe(false);
    });

    test('the admin menu lists every ported website section once', () => {
        const keys = ADMIN_MENU.map((item) => item.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toEqual(expect.arrayContaining([
            'analytics', 'systemAnalytics', 'funnelAnalytics', 'systemHealth', 'healthCheck', 'monitoring',
            'performance', 'ratingConfig', 'ratingsStatus', 'ratingsDebug', 'promotionsDebug',
        ]));
    });
});
