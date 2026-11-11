import { recalculateAnalyticsDay, type AnalyticsReportClient } from '@/lib/analyticsReportCommand';
import { getTimezone } from '@/lib/time';

export function recalcHourlyForDate({ supabase, dateStr }: { supabase: AnalyticsReportClient; dateStr: string }) {
    return recalculateAnalyticsDay(supabase, 'hourly', dateStr, getTimezone());
}
