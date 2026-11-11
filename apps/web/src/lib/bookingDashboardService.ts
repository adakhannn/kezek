import {
    cancelBookingUseCase,
    confirmBookingUseCase,
    type BookingCommandsPort,
} from '@core-domain/booking';

import { postInternalBooking } from '@/lib/internalBookingClient';
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

export async function cancelBooking(bookingId: string): Promise<void> {
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
    return postInternalBooking({ mode: 'simple', biz_id: params.bizId, branch_id: params.branchId,
        staff_id: params.staffId, service_id: params.serviceId, start_at: params.startAtISO,
        duration_min: params.minutes, client_id: params.clientId, client_name: params.clientName, client_phone: params.clientPhone });
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
    return postInternalBooking({ mode: 'complex', biz_id: params.bizId, branch_id: params.branchId,
        staff_id: params.staffId, start_at: params.startAtISO, client_id: params.clientId,
        client_name: params.clientName, client_phone: params.clientPhone, client_email: params.clientEmail ?? null,
        services: params.services.map((service, index) => ({ service_id: service.serviceId,
            duration_min: service.durationMin, order_index: service.orderIndex ?? index })) });
}

export type GetFreeSlotsParams = {
    bizId: string;
    serviceId: string;
    staffId: string;
    day: string;
    perStaff?: number;
    stepMinutes?: number;
};

export async function getFreeSlotsForServiceDay(params: GetFreeSlotsParams): Promise<DashboardSlot[]> {
    const { bizId, serviceId, staffId, day, perStaff = 400, stepMinutes = 15 } = params;
    if (!staffId || staffId === 'any') throw new Error('USE_PAGED_SLOTS');

    const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
        p_biz_id: bizId,
        p_service_id: serviceId,
        p_day: day,
        p_per_staff: perStaff,
        p_step_min: stepMinutes,
        p_staff_id: staffId,
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

