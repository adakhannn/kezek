import type { Period } from './allStaffFinanceStatsTypes';

/** The state keeps a business-local day anchor; presentation and API use period precision. */
export function financePeriodDate(period: Period, date: string): string {
    return period === 'day' ? date.slice(0, 10) : period === 'month' ? date.slice(0, 7) : date.split('-')[0];
}

export function financeDateAnchor(period: Period, value: string): string {
    if (!value) return '';
    return period === 'month' ? `${value}-01` : period === 'year' ? `${value}-01-01` : value;
}
