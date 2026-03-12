'use client';

import { useCallback, useState } from 'react';

import { notify } from '../notify';

import { createInternalBooking, type CreateInternalBookingParams } from '@/lib/bookingDashboardService';
import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';


export type QuickBookingGetParamsResult =
    | { ok: true; payload: CreateInternalBookingParams }
    | { ok: false; error: string };

export type UseQuickBookingOptions = {
    getParams: () => QuickBookingGetParamsResult;
    onSuccess: (bookingId: string) => void;
    showError: (message: string) => void;
};

export function useQuickBooking(options: UseQuickBookingOptions) {
    const { getParams, onSuccess, showError } = options;
    const [creating, setCreating] = useState(false);

    const create = useCallback(async () => {
        const result = getParams();
        if (!result.ok) {
            showError(result.error);
            return;
        }
        const payload = result.payload;
        setCreating(true);
        try {
            const bookingId = await createInternalBooking(payload);
            trackFunnelEvent({
                event_type: 'booking_success',
                source: 'quickdesk',
                biz_id: payload.bizId,
                branch_id: payload.branchId,
                service_id: payload.serviceId,
                service_ids: payload.serviceId ? [payload.serviceId] : undefined,
                services_count: payload.serviceId ? 1 : 0,
                staff_id: payload.staffId,
                slot_start_at: payload.startAtISO,
                booking_id: bookingId,
                session_id: getSessionId(),
            });
            await notify('confirm', bookingId);
            onSuccess(bookingId);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
        } finally {
            setCreating(false);
        }
    }, [getParams, onSuccess, showError]);

    return { create, creating };
}
