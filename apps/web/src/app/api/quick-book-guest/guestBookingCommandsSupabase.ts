import type { CreateGuestBookingParams } from '@core-domain/booking';
import { extractBookingId } from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError } from '@/lib/log';

type GuestBookingCommands = {
    holdGuestSlot(params: CreateGuestBookingParams): Promise<string>;
    confirmBooking(bookingId: string): Promise<void>;
};

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

export function createSupabaseGuestBookingCommands(
    supabase: SupabaseClient,
): GuestBookingCommands {
    return {
        async holdGuestSlot(params) {
            logDebug('QuickBookGuest', 'Calling hold_slot_guest RPC', {
                bizId: params.biz_id,
                branchId: params.branch_id,
                serviceId: params.service_id,
                staffId: params.staff_id,
                startAt: params.start_at,
            });

            const { data: rpcData, error } = await supabase.rpc<string, HoldSlotGuestArgs>(
                'hold_slot_guest',
                {
                    p_biz_id: params.biz_id,
                    p_branch_id: params.branch_id,
                    p_service_id: params.service_id,
                    p_staff_id: params.staff_id,
                    p_start: params.start_at,
                    p_client_name: params.client_name,
                    p_client_phone: params.client_phone,
                    p_client_email: params.client_email,
                },
            );

            if (error) {
                logError('QuickBookGuest', 'RPC error', error);
                throw new Error(error.message);
            }

            const bookingId = extractBookingId(rpcData);
            if (!bookingId) {
                logError('QuickBookGuest', 'Unexpected RPC result shape', { rpcData });
                throw new Error('Unexpected RPC result shape');
            }

            return bookingId;
        },

        async confirmBooking(bookingId: string) {
            const { data: confirmData, error: confirmError } = await supabase.rpc(
                'confirm_booking',
                {
                    p_booking_id: bookingId,
                },
            );

            if (confirmError) {
                logError('QuickBookGuest', 'Failed to confirm booking', {
                    error: confirmError.message,
                    code: confirmError.code,
                    details: confirmError.details,
                    hint: confirmError.hint,
                });
                return;
            }

            logDebug('QuickBookGuest', 'Booking confirmed successfully', {
                bookingId,
                confirmData,
            });
        },
    };
}
