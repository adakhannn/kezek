import { useQuery } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { supabase } from '../../lib/supabase';

/** Start and end of a business day (YYYY-MM-DD in the business zone), as UTC instants. */
export function businessDayBounds(day: string, timeZone?: string | null) {
    const tz = resolveBusinessTimeZone(timeZone);
    const start = fromZonedTime(`${day}T00:00:00`, tz);
    const nextDay = formatInTimeZone(addDays(fromZonedTime(`${day}T12:00:00`, tz), 1), tz, 'yyyy-MM-dd');
    return { start, end: fromZonedTime(`${nextDay}T00:00:00`, tz) };
}

/**
 * The signed-in client's active bookings in this business on the chosen day (web useClientBookings,
 * C8). Only a signed-in client is checked; a guest gets no request.
 */
export function useClientDayBookings(params: {
    bizId: string | null | undefined;
    day: string | null | undefined;
    timeZone?: string | null;
    userId: string | null;
}) {
    const { bizId, day, timeZone, userId } = params;
    return useQuery<number>({
        queryKey: ['client-day-bookings', userId, bizId, day, resolveBusinessTimeZone(timeZone)],
        queryFn: async () => {
            const { start, end } = businessDayBounds(day!, timeZone);
            const { data, error } = await supabase
                .from('bookings')
                .select('id')
                .eq('biz_id', bizId!)
                .eq('client_id', userId!)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', start.toISOString())
                .lt('start_at', end.toISOString());
            if (error) throw error;
            return data?.length ?? 0;
        },
        enabled: !!bizId && !!day && !!userId,
        staleTime: 60_000,
    });
}
