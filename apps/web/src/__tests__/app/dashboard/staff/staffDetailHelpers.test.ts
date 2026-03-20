import {
    getEffectiveRatingScore,
    getRatingAdvice,
    getServiceName,
} from '@/app/dashboard/staff/[id]/staffDetailHelpers';

describe('staff detail helpers', () => {
    const t = (_key: string, fallback: string) => fallback;

    test('getEffectiveRatingScore keeps only numeric scores', () => {
        expect(getEffectiveRatingScore(91.5)).toBe(91.5);
        expect(getEffectiveRatingScore(null)).toBeNull();
        expect(getEffectiveRatingScore(undefined)).toBeNull();
    });

    test('getRatingAdvice returns localized advice for low score', () => {
        expect(getRatingAdvice(55, t)).toContain('Нужно подтянуть базу');
    });

    test('getServiceName normalizes empty values', () => {
        expect(getServiceName('Маникюр')).toBe('Маникюр');
        expect(getServiceName(null)).toBe('');
    });
});
