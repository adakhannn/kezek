import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { EffectiveDay, ScheduleSnapshot } from './model';

import { getServiceClient } from '@/lib/supabaseService';

/** Server only: caller must have resolved the authenticated employee/business context. */
export async function readScheduledDay(staffId: string, bizId: string, date: Date | string) {
    const admin = getServiceClient();
    const { data: business, error: businessError } = await admin.from('businesses').select('tz').eq('id', bizId).single();
    if (businessError) throw businessError;
    const timezone = business?.tz || 'Asia/Bishkek';
    const ymd = typeof date === 'string' ? date : formatInTimeZone(date, timezone, 'yyyy-MM-dd');
    const { data, error } = await admin.rpc('read_staff_schedule', { p_staff: staffId, p_biz: bizId, p_from: ymd, p_to: ymd });
    if (error) throw error;
    const day = (data as ScheduleSnapshot)?.days?.[0] as EffectiveDay | undefined;
    if (!day) throw new Error('SCHEDULE_NOT_FOUND');
    return {
        day,
        ymd,
        expectedStart: day.intervals.length ? fromZonedTime(`${ymd}T${day.intervals[0].start}:00`, day.tz) : null,
    };
}
