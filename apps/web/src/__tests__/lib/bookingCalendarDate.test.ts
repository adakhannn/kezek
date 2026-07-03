import { ru } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';

import {
    formatBookingDayLabel,
    fromBookingCalendarDate,
    toBookingCalendarDate,
} from '@/lib/bookingCalendarDate';

describe('bookingCalendarDate', () => {
    const timezone = 'Asia/Bishkek';
    const businessMidnight = fromZonedTime('2026-06-27T00:00:00', timezone);

    it('formats the business date independently of the server timezone', () => {
        expect(formatBookingDayLabel(businessMidnight, timezone, ru)).toBe(
            '27.06.2026 (суббота)',
        );
    });

    it('uses stable local calendar parts and converts them back to business time', () => {
        const calendarDate = toBookingCalendarDate(businessMidnight, timezone);

        expect(calendarDate.getFullYear()).toBe(2026);
        expect(calendarDate.getMonth()).toBe(5);
        expect(calendarDate.getDate()).toBe(27);
        expect(calendarDate.getHours()).toBe(0);
        expect(fromBookingCalendarDate(calendarDate, timezone).toISOString()).toBe(
            businessMidnight.toISOString(),
        );
    });
});
