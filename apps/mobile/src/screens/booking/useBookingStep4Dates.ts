import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { formatDateLabel as formatDateLabelShared } from '@shared-client/formatters';

const TZ = 'Asia/Bishkek';
const DATE_COUNT = 30;

export function useBookingStep4Dates() {
    const todayInTz = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

    const dates = Array.from({ length: DATE_COUNT }, (_, index) =>
        formatInTimeZone(addDays(new Date(), index), TZ, 'yyyy-MM-dd'),
    );

    const formatDateLabel = (dateString: string) => {
        const { day, month } = formatDateLabelShared(dateString, 'ru-RU');
        const weekday = new Date(`${dateString}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short' });

        return {
            day,
            month,
            weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
        };
    };

    return {
        dates,
        todayInTz,
        formatDateLabel,
    };
}
