import { ru } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';

import {
    formatBookingDayLabel,
    formatBookingDateTime,
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

    it.each([
        ['2026-10-19', 'дүйшөмбү'], ['2026-10-20', 'шейшемби'], ['2026-10-21', 'шаршемби'],
        ['2026-10-22', 'бейшемби'], ['2026-10-23', 'жума'], ['2026-10-24', 'ишемби'], ['2026-10-25', 'жекшемби'],
    ])('formats the Kyrgyz weekday for business day %s', (date, weekday) => {
        const instant = fromZonedTime(`${date}T00:00:00`, timezone);
        const [year, month, day] = date.split('-');
        expect(formatBookingDayLabel(instant, timezone, 'ky')).toBe(`${day}.${month}.${year} (${weekday})`);
    });

    it.each([['ru', 'понедельник'], ['en', 'Monday']] as const)('supports the UI locale %s without changing the date', (locale, weekday) => {
        const instant = fromZonedTime('2026-10-19T00:00:00', timezone);
        expect(formatBookingDayLabel(instant, timezone, locale)).toBe(`19.10.2026 (${weekday})`);
    });

    it('uses the business timezone at a UTC date boundary in Kyrgyz', () => {
        expect(formatBookingDayLabel(new Date('2026-10-22T18:30:00Z'), timezone, 'ky')).toBe('23.10.2026 (жума)');
    });
});

describe('booking date-time presentation', () => {
    it.each([
        [1, 'январь'], [2, 'февраль'], [3, 'март'], [4, 'апрель'], [5, 'май'], [6, 'июнь'],
        [7, 'июль'], [8, 'август'], [9, 'сентябрь'], [10, 'октябрь'], [11, 'ноябрь'], [12, 'декабрь'],
    ])('formats Kyrgyz month %s without depending on browser Kyrgyz ICU', (month, label) => {
        expect(formatBookingDateTime(new Date(Date.UTC(2026, Number(month) - 1, 19, 7, 15)), 'Asia/Bishkek', 'ky'))
            .toBe(`2026-ж., 19-${label} 13:15`);
    });

    it('keeps the local day/year and midnight stable across the UTC date boundary', () => {
        expect(formatBookingDateTime(new Date('2026-12-31T18:00:00Z'), 'Asia/Bishkek', 'ky'))
            .toBe('2027-ж., 1-январь 00:00');
    });

    it.each([['ru', 'ru-RU'], ['en', 'en-US']] as const)('preserves existing %s formatting', (locale, intlLocale) => {
        const date = new Date('2026-10-19T07:15:00Z');
        expect(formatBookingDateTime(date, 'Asia/Bishkek', locale)).toBe(new Intl.DateTimeFormat(intlLocale, {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek',
        }).format(date));
    });
});
