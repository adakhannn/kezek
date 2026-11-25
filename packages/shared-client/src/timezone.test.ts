import {
    BUSINESS_TIME_ZONE_OPTIONS,
    DEFAULT_BUSINESS_TIME_ZONE,
    formatUtcOffset,
    isValidTimeZone,
    resolveBusinessTimeZone,
} from './timezone';

describe('business time zone', () => {
    it('defaults NULL, empty and unknown zones to Asia/Bishkek', () => {
        expect(DEFAULT_BUSINESS_TIME_ZONE).toBe('Asia/Bishkek');
        expect(resolveBusinessTimeZone(null)).toBe('Asia/Bishkek');
        expect(resolveBusinessTimeZone(undefined)).toBe('Asia/Bishkek');
        expect(resolveBusinessTimeZone('  ')).toBe('Asia/Bishkek');
        expect(resolveBusinessTimeZone('Mars/Olympus')).toBe('Asia/Bishkek');
    });

    it('keeps a known zone, trimmed', () => {
        expect(resolveBusinessTimeZone('Asia/Almaty')).toBe('Asia/Almaty');
        expect(resolveBusinessTimeZone(' Europe/Moscow ')).toBe('Europe/Moscow');
        expect(resolveBusinessTimeZone('UTC')).toBe('UTC');
    });

    it('validates only exact, known IANA names', () => {
        expect(isValidTimeZone('Asia/Bishkek')).toBe(true);
        expect(isValidTimeZone('Europe/Moscow')).toBe(true);
        expect(isValidTimeZone(' Asia/Bishkek')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
        expect(isValidTimeZone('Not/AZone')).toBe(false);
        expect(isValidTimeZone(42)).toBe(false);
        expect(isValidTimeZone(null)).toBe(false);
    });

    it('offers only zones the runtime knows, Bishkek first', () => {
        expect(BUSINESS_TIME_ZONE_OPTIONS[0]).toBe('Asia/Bishkek');
        for (const tz of BUSINESS_TIME_ZONE_OPTIONS) expect(isValidTimeZone(tz)).toBe(true);
        expect(new Set(BUSINESS_TIME_ZONE_OPTIONS).size).toBe(BUSINESS_TIME_ZONE_OPTIONS.length);
    });

    it('formats the UTC offset at an instant', () => {
        const at = new Date('2026-11-25T12:00:00Z');
        expect(formatUtcOffset('Asia/Bishkek', at)).toBe('UTC+06:00');
        expect(formatUtcOffset('Asia/Almaty', at)).toBe('UTC+05:00');
        expect(formatUtcOffset('Europe/Moscow', at)).toBe('UTC+03:00');
        expect(formatUtcOffset('America/New_York', at)).toBe('UTC-05:00');
        expect(formatUtcOffset('UTC', at)).toBe('UTC+00:00');
    });
});
