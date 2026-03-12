import type { BookingCommandsPort } from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';


import { logDebug, logError } from './log';

type BookingCommandsContext = {
    userId?: string;
};

/**
 * Supabase-адаптер для BookingCommandsPort.
 * Используется createBookingUseCase и другими бронированиями.
 */
export function createSupabaseBookingCommands(
    supabase: SupabaseClient,
    context: BookingCommandsContext = {},
): BookingCommandsPort {
    const { userId } = context;

    return {
        async holdSlot({ bizId, branchId, serviceId, staffId, startAt }) {
            logDebug('BookingCommandsSupabase', 'Calling hold_slot RPC', {
                userId,
                bizId,
                branchId,
                serviceId,
                staffId,
                startAt,
            });

            const { data: rpcData, error } = await supabase.rpc('hold_slot', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_service_id: serviceId,
                p_staff_id: staffId,
                p_start: startAt,
            });

            if (error) {
                logError('BookingCommandsSupabase', 'hold_slot RPC error', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                });
                throw new Error(error.message);
            }

            if (typeof rpcData !== 'string' || !rpcData) {
                logError('BookingCommandsSupabase', 'Unexpected hold_slot RPC result shape', {
                    rpcData,
                });
                throw new Error('Unexpected RPC result shape');
            }

            logDebug('BookingCommandsSupabase', 'hold_slot RPC success', { bookingId: rpcData });
            return rpcData;
        },

        async holdComplexSlot({ bizId, branchId, staffId, startAt, services }) {
            logDebug('BookingCommandsSupabase', 'Calling hold_complex_slot RPC', {
                userId,
                bizId,
                branchId,
                staffId,
                startAt,
                servicesCount: services.length,
            });

            const servicesJson = services.map((s) => ({
                service_id: s.service_id,
                duration_min: s.duration_min,
                order_index: s.order_index,
            }));

            const { data: rpcData, error } = await supabase.rpc('hold_complex_slot', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_staff_id: staffId,
                p_start: startAt,
                p_services: servicesJson,
            });

            if (error) {
                logError('BookingCommandsSupabase', 'hold_complex_slot RPC error', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                });
                throw new Error(error.message);
            }

            if (typeof rpcData !== 'string' || !rpcData) {
                logError('BookingCommandsSupabase', 'Unexpected hold_complex_slot RPC result shape', {
                    rpcData,
                });
                throw new Error('Unexpected RPC result shape');
            }

            logDebug('BookingCommandsSupabase', 'hold_complex_slot RPC success', { bookingId: rpcData });
            return rpcData;
        },

        async confirmBooking(bookingId: string) {
            logDebug('BookingCommandsSupabase', 'Attempting to confirm booking', {
                bookingId,
                userId,
            });

            const { error: confirmError } = await supabase.rpc('confirm_booking', {
                p_booking_id: bookingId,
            });

            if (confirmError) {
                logError('BookingCommandsSupabase', 'Failed to confirm booking', {
                    bookingId,
                    error: confirmError.message,
                    code: confirmError.code,
                    details: confirmError.details,
                    hint: confirmError.hint,
                });
                throw new Error(confirmError.message);
            }

            logDebug('BookingCommandsSupabase', 'Booking confirmed successfully', { bookingId });
        },

        async cancelBooking(bookingId: string) {
            logDebug('BookingCommandsSupabase', 'cancelBooking not implemented in this adapter', {
                bookingId,
                userId,
            });
            // Реализация по необходимости в других use-case'ах
        },
    };
}

