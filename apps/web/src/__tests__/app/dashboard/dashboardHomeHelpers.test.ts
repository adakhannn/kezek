import {
    formatDashboardHomeDate,
    getDashboardBizName,
    shouldShowLowRatingHint,
} from '@/app/dashboard/components/dashboardHomeHelpers';

describe('dashboardHomeHelpers', () => {
    it('returns explicit business name when present', () => {
        expect(getDashboardBizName('Salon', 'Fallback')).toBe('Salon');
        expect(getDashboardBizName(null, 'Fallback')).toBe('Fallback');
    });

    it('formats date using mapped locale', () => {
        const formatted = formatDashboardHomeDate('2026-03-20T00:00:00.000Z', 'ru');
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted[0]).toBe(formatted[0].toUpperCase());
    });

    it('shows low rating hint only for low scores', () => {
        expect(shouldShowLowRatingHint(9.5)).toBe(true);
        expect(shouldShowLowRatingHint(11)).toBe(false);
        expect(shouldShowLowRatingHint(null)).toBe(false);
    });
});
