import { addDaysToDateString } from '@/lib/time';

export function analyticsPresetStart(end: string, days: number) {
    // Both aggregate endpoints include the start and end dates.
    return addDaysToDateString(end, 1 - days);
}

export function analyticsRangeError(start: string, end: string) {
    if (!start || !end) return 'analytics.dateRequired';
    const validDate = (value: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!validDate(start) || !validDate(end)) return 'analytics.dateFormat';
    return start > end ? 'analytics.dateOrder' : null;
}
