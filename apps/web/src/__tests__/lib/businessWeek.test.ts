import { formatInTimeZone } from 'date-fns-tz';

import { addDaysYmd, businessDayOfWeek, businessWeekDates, businessWeekYmds } from '@/lib/scheduling/businessWeek';

describe('businessWeek (ARCH-11)', () => {
    test('adds calendar days across month and year ends', () => {
        expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDaysYmd('2026-11-09', 7)).toBe('2026-11-16');
    });

    test('a week runs Monday to Sunday in the business zone', () => {
        // Wed 2026-11-11 10:00 UTC.
        expect(businessWeekYmds(0, 'Asia/Bishkek', new Date('2026-11-11T10:00:00Z'))).toEqual([
            '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
        ]);
        expect(businessWeekYmds(1, 'Asia/Bishkek', new Date('2026-11-11T10:00:00Z'))[0]).toBe('2026-11-16');
    });

    test('near midnight the week follows the business day, not UTC', () => {
        // Sun 2026-11-15 20:00 UTC is already Monday 16 Nov 02:00 in Bishkek, still Sunday in London.
        const now = new Date('2026-11-15T20:00:00Z');
        expect(businessWeekYmds(0, 'Asia/Bishkek', now)[0]).toBe('2026-11-16');
        expect(businessWeekYmds(0, 'Europe/London', now)[0]).toBe('2026-11-09');
    });

    test('week dates format back to the same business dates and weekdays', () => {
        const now = new Date('2026-11-15T20:00:00Z');
        for (const tz of ['Asia/Bishkek', 'Pacific/Auckland', 'America/Los_Angeles']) {
            const dates = businessWeekDates(0, tz, now);
            expect(dates.map((d) => formatInTimeZone(d, tz, 'yyyy-MM-dd'))).toEqual(businessWeekYmds(0, tz, now));
            expect(dates.map((d) => businessDayOfWeek(d, tz))).toEqual([1, 2, 3, 4, 5, 6, 0]);
        }
    });
});
