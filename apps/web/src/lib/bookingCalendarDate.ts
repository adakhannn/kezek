import { format, type Locale } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

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

export function formatBookingDayLabel(date: Date, timezone: string, locale: Locale): string {
    const dateString = formatInTimeZone(date, timezone, 'dd.MM.yyyy', { locale });
    const weekday = formatInTimeZone(date, timezone, 'EEEE', { locale });

    return `${dateString} (${weekday})`;
}
