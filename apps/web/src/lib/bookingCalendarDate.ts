import { format, type Locale } from 'date-fns';
import { enGB, ru } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export type BookingDayLocale = Locale | 'ru' | 'ky' | 'en';

// date-fns has no Kyrgyz locale. Keep this UI label deterministic across
// server/browser ICU installations, using the weekday in the business timezone.
const KY_WEEKDAYS = ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби'];
const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** Keep Kyrgyz visit dates stable even in browsers without the Kyrgyz ICU locale. */
export function formatBookingDateTime(date: Date, timezone: string, locale: 'ru' | 'ky' | 'en'): string {
    if (locale === 'ky') {
        const [calendar, time] = formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm').split(' ');
        const [year, month, day] = calendar.split('-');
        return `${year}-ж., ${Number(day)}-${KY_MONTHS[Number(month) - 1]} ${time}`;
    }
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone,
    }).format(date);
}

export function toBookingCalendarDate(date: Date, timezone: string): Date {
    const [year, month, day] = formatInTimeZone(date, timezone, 'yyyy-MM-dd')
        .split('-')
        .map(Number);

    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function fromBookingCalendarDate(date: Date, timezone: string): Date {
    const dateString = format(date, 'yyyy-MM-dd');
    return fromZonedTime(`${dateString}T00:00:00`, timezone);
}

export function formatBookingWeekday(date: Date, timezone: string, locale: BookingDayLocale): string {
    return locale === 'ky'
        ? KY_WEEKDAYS[Number(formatInTimeZone(date, timezone, 'i')) - 1]
        : formatInTimeZone(date, timezone, 'EEEE', {
            locale: typeof locale === 'string' ? (locale === 'en' ? enGB : ru) : locale,
        });
}

export function formatBookingDayLabel(date: Date, timezone: string, locale: BookingDayLocale): string {
    const dateString = formatInTimeZone(date, timezone, 'dd.MM.yyyy');
    return `${dateString} (${formatBookingWeekday(date, timezone, locale)})`;
}
