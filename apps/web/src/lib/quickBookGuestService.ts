import { extractBookingId } from '@core-domain/booking';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

type HoldSlotGuestArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_service_id: string;
    p_staff_id: string;
    p_start: string;
    p_client_name: string;
    p_client_phone: string;
    p_client_email?: string | null;
};

type HoldComplexSlotGuestArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_staff_id: string;
    p_start: string;
    p_services: { service_id: string; duration_min: number; order_index?: number }[];
    p_client_name: string;
    p_client_phone: string;
    p_client_email?: string | null;
};

export type QuickBookGuestInput = {
    biz_id: string;
    branch_id: string;
    service_id: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
    client_name: string;
    client_phone: string;
    client_email?: string | null;
};

export type QuickBookGuestSupabasePort = {
    from: (table: string) => {
        select: (query: string) => {
            eq: (column: string, value: unknown) => any;
        };
    };
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{
        data: unknown;
        error: { message: string; code?: string; details?: string; hint?: string } | null;
    }>;
};

type NotifyGuestBooking = (payload: {
    bookingId: string;
    type: 'hold' | 'confirm';
}) => Promise<void>;

export async function runQuickBookGuest(
    deps: {
        supabase: QuickBookGuestSupabasePort;
        notifyGuestBooking: NotifyGuestBooking;
    },
    input: QuickBookGuestInput,
) {
    const { supabase, notifyGuestBooking } = deps;

    const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', input.branch_id)
        .eq('biz_id', input.biz_id)
        .eq('is_active', true)
        .maybeSingle();

    if (branchError || !branch?.id) {
        return createErrorResponse(
            'not_found',
            'No active branch found for guest booking',
            { code: 'no_branch' },
            400,
        );
    }

    const useComplex = !!input.services && input.services.length > 1;
    let rpcData: string | null = null;
    let rpcError: { message: string } | null = null;

    if (useComplex) {
        logDebug('QuickBookGuestService', 'Calling hold_complex_slot_guest RPC', {
            servicesCount: input.services!.length,
        });

        const result = await supabase.rpc('hold_complex_slot_guest', {
            p_biz_id: input.biz_id,
            p_branch_id: branch.id,
            p_staff_id: input.staff_id,
            p_start: input.start_at,
            p_services: input.services!,
            p_client_name: input.client_name,
            p_client_phone: input.client_phone,
            p_client_email: input.client_email,
        } satisfies HoldComplexSlotGuestArgs);

        rpcData = typeof result.data === 'string' ? result.data : null;
        rpcError = result.error;
    } else {
        logDebug('QuickBookGuestService', 'Calling hold_slot_guest RPC');

        const result = await supabase.rpc('hold_slot_guest', {
            p_biz_id: input.biz_id,
            p_branch_id: branch.id,
            p_service_id: input.service_id,
            p_staff_id: input.staff_id,
            p_start: input.start_at,
            p_client_name: input.client_name,
            p_client_phone: input.client_phone,
            p_client_email: input.client_email,
        } satisfies HoldSlotGuestArgs);

        rpcData = typeof result.data === 'string' ? result.data : null;
        rpcError = result.error;
    }

    if (rpcError) {
        logError('QuickBookGuestService', 'Booking hold RPC failed', rpcError);
        return createErrorResponse('validation', rpcError.message, { code: 'rpc' }, 400);
    }

    const bookingId = extractBookingId(rpcData);
    if (!bookingId) {
        logError('QuickBookGuestService', 'Unexpected RPC result shape', { rpcData });
        return createErrorResponse(
            'validation',
            'Unexpected RPC result format',
            { code: 'rpc_shape' },
            400,
        );
    }

    const { data: confirmData, error: confirmError } = await supabase.rpc(
        'confirm_booking',
        {
            p_booking_id: bookingId,
        },
    );

    if (confirmError) {
        logError('QuickBookGuestService', 'Failed to confirm booking', {
            error: confirmError.message,
            code: confirmError.code,
            details: confirmError.details,
            hint: confirmError.hint,
        });
    } else {
        logDebug('QuickBookGuestService', 'Booking confirmed successfully', {
            bookingId,
            confirmData,
        });
    }

    try {
        await notifyGuestBooking({ bookingId, type: 'confirm' });
        logDebug('QuickBookGuestService', 'Guest notification sent', { bookingId });
    } catch (error) {
        logError('QuickBookGuestService', 'notifyGuestBooking failed', error);
    }

    return {
        bookingId,
        confirmed: true,
    };
}
