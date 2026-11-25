import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { useLanguage } from '../../i18n';
import { formatBookingDateLabel } from './bookingFormat';

/** Dates are days of the business calendar: `timeZone` is businesses.tz (NULL means Asia/Bishkek, ARCH-11). */
const DATE_COUNT = 30;

export function useBookingStep4Dates(timeZone?: string | null) {
    const { locale } = useLanguage();
    const tz = resolveBusinessTimeZone(timeZone);
    const todayInTz = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

    const dates = Array.from({ length: DATE_COUNT }, (_, index) =>
        formatInTimeZone(addDays(new Date(), index), tz, 'yyyy-MM-dd'),
    );

    const formatDateLabel = (dateString: string) => {
        const { day, month, weekday } = formatBookingDateLabel(dateString, locale);
        return { day, month, weekday };
    };

    return {
        dates,
        todayInTz,
        formatDateLabel,
    };
}
