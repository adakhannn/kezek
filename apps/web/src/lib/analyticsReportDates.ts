import { assertReportRange } from '@/lib/analyticsReportSnapshot';
import { addDaysToDateString, dateRangeInclusive } from '@/lib/time';

/** Revisit complete dates after the last business timezone has finished its day. */
export function analyticsReportDates(today: string, timezone: string, start?: string | null, end?: string | null): string[] {
    if (start || end) {
        assertReportRange(start ?? '', end ?? '');
        return dateRangeInclusive(start!, end!, timezone);
    }
    // Three dates cover the global UTC-12..UTC+14 spread even for an early cron.
    return [-3, -2, -1].map(offset => addDaysToDateString(today, offset, timezone));
}
