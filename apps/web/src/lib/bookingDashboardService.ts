import {
    cancelBookingUseCase,
    confirmBookingUseCase,
    type BookingCommandsPort,
} from '@core-domain/booking';

import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

export type DashboardSlot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

function createDashboardBookingCommands(): BookingCommandsPort {
    return {
        async holdSlot() {
            throw new Error('holdSlot is not supported in booking dashboard actions');
        },

        async confirmBooking(bookingId: string) {
            const { error } = await supabase.rpc('confirm_booking', {
                p_booking_id: bookingId,
            });
            if (error) {
                logError('BookingDashboardService', 'confirm_booking error', {
                    bookingId,
                    error,
                });
                throw error;
            }
        },

        async cancelBooking(bookingId: string) {
            const { error } = await supabase.rpc('cancel_booking', {
                p_booking_id: bookingId,
            });
            if (error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('not assigned to branch') || msg.includes('staff')) {
                    const { error: updateError } = await supabase
                        .from('bookings')
                        .update({ status: 'cancelled' })
                        .eq('id', bookingId);

                    if (updateError) {
                        logError(
                            'BookingDashboardService',
                            'cancel_booking fallback update error',
                            {
                                bookingId,
                                error: updateError,
                            },
                        );
                        throw updateError;
                    }

                    return;
                }

                logError('BookingDashboardService', 'cancel_booking error', {
                    bookingId,
                    error,
                });
                throw error;
            }
        },
    };
}

export async function confirmBooking(bookingId: string): Promise<void> {
    await confirmBookingUseCase(
        {
            commands: createDashboardBookingCommands(),
        },
        bookingId,
    );
}

export async function cancelBookingWithFallback(bookingId: string): Promise<void> {
    await cancelBookingUseCase(
        {
            commands: createDashboardBookingCommands(),
        },
        bookingId,
    );
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

export type CreateInternalComplexBookingService = {
    serviceId: string;
    durationMin: number;
    orderIndex?: number;
};

export type CreateInternalComplexBookingParams = {
    bizId: string;
    branchId: string;
    staffId: string;
    startAtISO: string;
    services: CreateInternalComplexBookingService[];
    clientId: string | null;
    clientName: string | null;
    clientPhone: string | null;
    clientEmail?: string | null;
};

export async function createInternalComplexBooking(params: CreateInternalComplexBookingParams): Promise<string> {
    const { bizId, branchId, staffId, startAtISO, services, clientId, clientName, clientPhone, clientEmail } = params;

    const servicesPayload = services.map((s, index) => ({
        service_id: s.serviceId,
        duration_min: s.durationMin,
        order_index: typeof s.orderIndex === 'number' ? s.orderIndex : index,
    }));

    const { data, error } = await supabase.rpc('create_internal_complex_booking', {
        p_biz_id: bizId,
        p_branch_id: branchId,
        p_staff_id: staffId,
        p_start: startAtISO,
        p_services: servicesPayload,
        p_client_id: clientId,
        p_client_name: clientName,
        p_client_phone: clientPhone,
        p_client_email: clientEmail ?? null,
    });

    if (error) {
        logError('BookingDashboardService', 'create_internal_complex_booking error', { params, error });
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

export type GetFreeSlotsComplexParams = {
    bizId: string;
    branchId: string | null;
    staffId: string;
    day: string;
    totalDurationMin: number;
    perStaff?: number;
    stepMinutes?: number;
};

export async function getFreeSlotsForComplexDay(params: GetFreeSlotsComplexParams): Promise<DashboardSlot[]> {
    const { bizId, branchId, staffId, day, totalDurationMin, perStaff = 200, stepMinutes = 15 } = params;

    const { data, error } = await supabase.rpc('get_free_slots_complex_day_v1', {
        p_biz_id: bizId,
        p_branch_id: branchId,
        p_staff_id: staffId,
        p_day: day,
        p_duration_min: totalDurationMin,
        p_step_min: stepMinutes,
        p_per_staff: perStaff,
    });

    if (error) {
        logError('BookingDashboardService', 'get_free_slots_complex_day_v1 error', { params, error });
        throw error;
    }

    return (data ?? []) as DashboardSlot[];
}

