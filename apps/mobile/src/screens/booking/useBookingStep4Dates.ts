import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { useLanguage } from '../../i18n';
import { formatBookingDateLabel } from './bookingFormat';

const TZ = 'Asia/Bishkek';
const DATE_COUNT = 30;

export function useBookingStep4Dates() {
    const { locale } = useLanguage();
    const todayInTz = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

    const dates = Array.from({ length: DATE_COUNT }, (_, index) =>
        formatInTimeZone(addDays(new Date(), index), TZ, 'yyyy-MM-dd'),
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
