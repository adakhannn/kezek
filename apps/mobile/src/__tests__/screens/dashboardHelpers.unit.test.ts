import { getDashboardSubtitleLabel, getPrimaryBusinessPhone } from '../../screens/dashboard/helpers';

describe('dashboard helpers', () => {
    it('returns singular subtitle for one business', () => {
        expect(getDashboardSubtitleLabel(1)).toBe('Управление бизнесом');
    });

    it('returns plural subtitle for multiple businesses', () => {
        expect(getDashboardSubtitleLabel(2)).toBe('Управление бизнесами');
    });

    it('returns trimmed primary phone when present', () => {
        expect(getPrimaryBusinessPhone({ phones: ['  +7 777 000 00 00  ', null] })).toBe(
            '+7 777 000 00 00'
        );
    });

    it('returns null when there is no usable phone', () => {
        expect(getPrimaryBusinessPhone({ phones: ['   ', null] })).toBeNull();
    });
});
