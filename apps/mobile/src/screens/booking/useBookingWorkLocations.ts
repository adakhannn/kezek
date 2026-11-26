import { useQuery } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { apiRequest } from '../../lib/api';
import type { WorkLocation } from './bookingSelection';
import { DATE_COUNT } from './useBookingStep4Dates';

type WorkLocationsResponse = { ok?: boolean; data?: unknown };

function isWorkLocation(value: unknown): value is WorkLocation {
    const row = value as Partial<WorkLocation> | null;
    return (
        !!row &&
        typeof row.staff_id === 'string' &&
        typeof row.branch_id === 'string' &&
        typeof row.date_on === 'string'
    );
}

/**
 * Where masters work on the booking days (the dates of step 4), as the website reads them
 * (useTemporaryTransfers → GET /api/public/work-locations). Masters at another branch than
 * their home one are offered there (C5).
 */
export function useBookingWorkLocations(bizId: string | null | undefined, timeZone?: string | null) {
    const tz = resolveBusinessTimeZone(timeZone);
    const now = new Date();
    const from = formatInTimeZone(now, tz, 'yyyy-MM-dd');
    const to = formatInTimeZone(addDays(now, DATE_COUNT - 1), tz, 'yyyy-MM-dd');

    return useQuery<WorkLocation[]>({
        queryKey: ['booking-work-locations', bizId, from, to],
        queryFn: async () => {
            const query = `bizId=${encodeURIComponent(bizId!)}&from=${from}&to=${to}`;
            const response = await apiRequest<WorkLocationsResponse>(`/api/public/work-locations?${query}`, {
                method: 'GET',
            });
            if (!response || response.ok !== true || !Array.isArray(response.data)) {
                throw new Error('Invalid work-location response');
            }
            return response.data.filter(isWorkLocation);
        },
        enabled: !!bizId,
        staleTime: 60_000,
    });
}
