import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { addDays, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { TZ } from '@/lib/time';

async function fetchFinanceDate(staffId: string | undefined, date: Date, signal?: AbortSignal) {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const apiUrl = staffId
        ? `/api/staff/finance?staffId=${encodeURIComponent(staffId)}&date=${dateStr}`
        : `/api/staff/finance?date=${dateStr}`;

    const response = await fetch(apiUrl, {
        cache: 'no-store',
        signal,
    });

    if (!response.ok) {
        throw new Error('Не удалось загрузить данные');
    }

    const json = await response.json();
    if (!json.ok) {
        throw new Error(json.error || 'Не удалось загрузить данные');
    }

    return json;
}

export function useFinanceDatePrefetch(shiftDate: Date, staffId?: string) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const prevDate = subDays(shiftDate, 1);
        const nextDate = addDays(shiftDate, 1);
        const prevDateStr = formatInTimeZone(prevDate, TZ, 'yyyy-MM-dd');
        const nextDateStr = formatInTimeZone(nextDate, TZ, 'yyyy-MM-dd');
        const todayStr = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

        if (prevDateStr <= todayStr) {
            queryClient.prefetchQuery({
                queryKey: ['finance', staffId || 'current', prevDateStr],
                queryFn: ({ signal }) => fetchFinanceDate(staffId, prevDate, signal),
                staleTime: 30 * 1000,
                gcTime: 60 * 60 * 1000,
            });
        }

        const maxFutureDate = addDays(new Date(), 7);
        if (nextDateStr <= formatInTimeZone(maxFutureDate, TZ, 'yyyy-MM-dd')) {
            queryClient.prefetchQuery({
                queryKey: ['finance', staffId || 'current', nextDateStr],
                queryFn: ({ signal }) => fetchFinanceDate(staffId, nextDate, signal),
                staleTime: nextDateStr === todayStr ? 5 * 1000 : 30 * 1000,
                gcTime: nextDateStr === todayStr ? 5 * 60 * 1000 : 60 * 60 * 1000,
            });
        }
    }, [queryClient, shiftDate, staffId]);
}
