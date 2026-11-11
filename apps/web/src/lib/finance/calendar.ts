import type { SupabaseClient } from '@supabase/supabase-js';

export function isFinanceDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export type FinanceCalendar = { date: string; todayDate: string; timezone: string; dayStart: string; dayEnd: string; dayHours: number };
export async function readFinanceCalendar(client: Pick<SupabaseClient, 'rpc'>, bizId: string, staffId: string, target?: string | Date): Promise<FinanceCalendar> {
    const { data, error } = await client.rpc('read_staff_finance_calendar', {
        p_biz_id: bizId, p_staff_id: staffId, p_date: typeof target === 'string' ? target : null,
        p_instant: target instanceof Date ? target.toISOString() : null,
    });
    if (error) throw new Error(error.message || 'Failed to read business calendar');
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{4}-\d{2}-\d{2}$/.test(data.todayDate) ||
        typeof data.timezone !== 'string' || !Number.isFinite(Date.parse(data.dayStart)) ||
        !Number.isFinite(Date.parse(data.dayEnd)) || !(data.dayHours > 0) ||
        Date.parse(data.dayEnd) - Date.parse(data.dayStart) !== data.dayHours * 3600000) throw new Error('Invalid business calendar');
    return data as FinanceCalendar;
}
