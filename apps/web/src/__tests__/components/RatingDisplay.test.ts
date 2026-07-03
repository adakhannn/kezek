import { formatRatingDisplayValue } from '@/components/RatingDisplay';

describe('formatRatingDisplayValue', () => {
    test('normalizes 0-100 scores to the public 0-5 star scale', () => {
        expect(formatRatingDisplayValue(100)).toBe('5.0');
        expect(formatRatingDisplayValue(50)).toBe('2.5');
        expect(formatRatingDisplayValue(10)).toBe('0.5');
    });

    test('keeps already-normalized star ratings on the 0-5 scale', () => {
        expect(formatRatingDisplayValue(4.75)).toBe('4.8');
        expect(formatRatingDisplayValue(0)).toBe('0.0');
    });

    test('clamps display values to the 0-5 scale', () => {
        expect(formatRatingDisplayValue(140)).toBe('5.0');
        expect(formatRatingDisplayValue(-10)).toBe('0.0');
    });
});
