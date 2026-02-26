import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

export type DashboardSlot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

export async function confirmBooking(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
    if (error) {
        logError('BookingDashboardService', 'confirm_booking error', { bookingId, error });
        throw error;
    }
}

export async function cancelBookingWithFallback(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
    if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('not assigned to branch') || msg.includes('staff')) {
            const { error: updateError } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

            if (updateError) {
                logError('BookingDashboardService', 'cancel_booking fallback update error', {
                    bookingId,
                    error: updateError,
                });
                throw updateError;
            }
        } else {
            logError('BookingDashboardService', 'cancel_booking error', { bookingId, error });
            throw error;
        }
    }
}

export type CreateInternalBookingParams = {
    bizId: string;
    branchId: string;
    serviceId: string;
    staffId: string;
    startAtISO: string;
    minutes: number;
    clientId: string | null;
    clientName: string | null;
    clientPhone: string | null;
};

export async function createInternalBooking(params: CreateInternalBookingParams): Promise<string> {
    const { bizId, branchId, serviceId, staffId, startAtISO, minutes, clientId, clientName, clientPhone } = params;

    const { data, error } = await supabase.rpc('create_internal_booking', {
        p_biz_id: bizId,
        p_branch_id: branchId,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_start: startAtISO,
        p_minutes: minutes,
        p_client_id: clientId,
        p_client_name: clientName,
        p_client_phone: clientPhone,
    });

    if (error) {
        logError('BookingDashboardService', 'create_internal_booking error', { params, error });
        throw error;
    }

    return String(data);
}

export type GetFreeSlotsParams = {
    bizId: string;
    serviceId: string;
    day: string;
    perStaff?: number;
    stepMinutes?: number;
};

export async function getFreeSlotsForServiceDay(params: GetFreeSlotsParams): Promise<DashboardSlot[]> {
    const { bizId, serviceId, day, perStaff = 400, stepMinutes = 15 } = params;

    const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
        p_biz_id: bizId,
        p_service_id: serviceId,
        p_day: day,
        p_per_staff: perStaff,
        p_step_min: stepMinutes,
    });

    if (error) {
        logError('BookingDashboardService', 'get_free_slots_service_day_v2 error', { params, error });
        throw error;
    }

    return (data ?? []) as DashboardSlot[];
}

