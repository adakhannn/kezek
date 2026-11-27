/**
 * A master books a client who calls or walks in, as the website's /staff/bookings "Создать запись"
 * (CreateBookingForm.tsx): one service or a complex of several, this master, this branch, a free
 * slot more than 30 minutes ahead, then /api/bookings/internal.
 */
import { addMinutes } from 'date-fns';
import { filterSlotsByContext } from '@core-domain/schedule';

import { apiRequest } from '../../lib/api';
import { acknowledgeBookingRequest, getBookingRequestKey } from '../../lib/bookingRequest';
import { supabase } from '../../lib/supabase';

export type StaffBookingService = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    branch_id: string;
};

export type StaffBookingBranch = { id: string; name: string };

export type FreeSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

/**
 * The business's active branches and the active services this master performs (an active
 * service_staff row), read with the master's session. A service nobody assigned to the master has
 * no free time for them, so it is not offered (as the client flow hides services without a master).
 */
export async function fetchStaffBookingOptions(bizId: string, staffId: string): Promise<{ branches: StaffBookingBranch[]; services: StaffBookingService[] }> {
    const [branchesResult, servicesResult, assignedResult] = await Promise.all([
        supabase.from('branches').select('id, name, is_active').eq('biz_id', bizId).eq('is_active', true).order('name'),
        supabase
            .from('services')
            .select('id, name_ru, name_ky, name_en, duration_min, active, branch_id')
            .eq('biz_id', bizId)
            .eq('active', true)
            .order('name_ru'),
        supabase.from('service_staff').select('service_id').eq('staff_id', staffId).eq('is_active', true),
    ]);
    if (branchesResult.error) throw branchesResult.error;
    if (servicesResult.error) throw servicesResult.error;
    if (assignedResult.error) throw assignedResult.error;
    const assigned = new Set(((assignedResult.data ?? []) as { service_id: string }[]).map((row) => row.service_id));
    return {
        branches: ((branchesResult.data ?? []) as StaffBookingBranch[]).map(({ id, name }) => ({ id, name })),
        services: ((servicesResult.data ?? []) as StaffBookingService[]).filter((service) => assigned.has(service.id)),
    };
}

export function servicesOfBranch(services: StaffBookingService[], branchId: string): StaffBookingService[] {
    return branchId ? services.filter((service) => service.branch_id === branchId) : [];
}

/** The chosen services in the order they were picked. */
export function pickedServices(services: StaffBookingService[], ids: string[]): StaffBookingService[] {
    return ids.flatMap((id) => services.find((service) => service.id === id) ?? []);
}

export function totalDuration(services: StaffBookingService[]): number {
    return services.reduce((sum, service) => sum + (service.duration_min ?? 0), 0);
}

/** This master's free starts in this branch, more than 30 minutes ahead, each start once. */
export function bookableSlots(raw: FreeSlot[], staffId: string, branchId: string, now: Date = new Date()): FreeSlot[] {
    const filtered = filterSlotsByContext(raw, {
        staffId,
        branchId,
        isTemporaryTransfer: false,
        minStart: addMinutes(now, 30),
    }) as FreeSlot[];
    return Array.from(new Map(filtered.map((slot) => [slot.start_at, slot])).values());
}

export async function fetchFreeSlots(params: {
    bizId: string;
    branchId: string;
    staffId: string;
    day: string;
    services: StaffBookingService[];
}): Promise<FreeSlot[]> {
    const { bizId, branchId, staffId, day, services } = params;
    if (!services.length) return [];
    if (services.length === 1) {
        const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
            p_biz_id: bizId,
            p_service_id: services[0].id,
            p_day: day,
            p_per_staff: 400,
            p_step_min: 15,
            p_staff_id: staffId,
        });
        if (error) throw error;
        return (data ?? []) as FreeSlot[];
    }
    const duration = totalDuration(services);
    if (duration <= 0) return [];
    const { data, error } = await supabase.rpc('get_free_slots_complex_day_v1', {
        p_biz_id: bizId,
        p_branch_id: branchId,
        p_staff_id: staffId,
        p_day: day,
        p_duration_min: duration,
        p_step_min: 15,
        p_per_staff: 200,
    });
    if (error) throw error;
    return (data ?? []) as FreeSlot[];
}

export type InternalBookingInput =
    | {
          mode: 'simple';
          biz_id: string;
          branch_id: string;
          staff_id: string;
          service_id: string;
          start_at: string;
          duration_min: number;
          client_id: null;
          client_name: string;
          client_phone: string;
      }
    | {
          mode: 'complex';
          biz_id: string;
          branch_id: string;
          staff_id: string;
          start_at: string;
          client_id: null;
          client_name: string;
          client_phone: string;
          client_email: null;
          services: { service_id: string; duration_min: number; order_index: number }[];
      };

/** The website's body for /api/bookings/internal (internalBookingClient.ts). */
export function buildInternalBookingInput(params: {
    bizId: string;
    branchId: string;
    staffId: string;
    startAt: string;
    services: StaffBookingService[];
    clientName: string;
    clientPhone: string;
}): InternalBookingInput {
    const common = {
        biz_id: params.bizId,
        branch_id: params.branchId,
        staff_id: params.staffId,
        start_at: params.startAt,
        client_id: null,
        client_name: params.clientName.trim(),
        client_phone: params.clientPhone.trim(),
    };
    if (params.services.length === 1) {
        return { ...common, mode: 'simple', service_id: params.services[0].id, duration_min: params.services[0].duration_min };
    }
    return {
        ...common,
        mode: 'complex',
        client_email: null,
        services: params.services.map((service, index) => ({ service_id: service.id, duration_min: service.duration_min, order_index: index })),
    };
}

type InternalBookingResponse = { ok?: boolean; data?: { booking_id?: string; confirmed?: boolean } };

/**
 * Sends the booking with an Idempotency-Key bound to the account and the request, so a retry after
 * a lost answer replays the same booking instead of making a second one (web internalBookingClient).
 */
export async function createInternalBooking(input: InternalBookingInput): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Not signed in');
    const requestId = await getBookingRequestKey(userId, { kind: 'internal', payload: input });
    const response = await apiRequest<InternalBookingResponse>('/api/bookings/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
        body: JSON.stringify(input),
    });
    const bookingId = response?.data?.booking_id;
    if (!response?.ok || response.data?.confirmed !== true || typeof bookingId !== 'string') {
        throw new Error('Booking was not confirmed');
    }
    try {
        await acknowledgeBookingRequest(userId, { kind: 'internal', payload: input }, requestId);
    } catch {
        // A retained key safely replays the receipt.
    }
    return bookingId;
}
