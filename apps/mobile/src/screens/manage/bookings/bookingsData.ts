import { apiRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { dayRangeInclusive } from '../opsKit/dates';
import { parseDashboardBookingsPage, type BookingStatus, type BookingsRpcArgs } from './bookingsQuery';

/*
 * The reads of the website's /dashboard/bookings, from the same sources: the option lists of the
 * page (RLS-scoped tables), the calendar day and the list page (the browser's own Supabase reads
 * on the website), the masters' work places (GET /api/staff/work-locations) and free times
 * (get_free_slots_service_day_v2).
 */

export type ServiceOption = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    duration_min: number;
    branch_id: string;
};
export type StaffOption = { id: string; full_name: string; branch_id: string };
export type BranchOption = { id: string; name: string };
export type BookingOptions = { services: ServiceOption[]; staff: StaffOption[]; branches: BranchOption[] };

/** The active services, masters and branches of the business (the website page's server read). */
export async function fetchBookingOptions(bizId: string): Promise<BookingOptions> {
    const [services, staff, branches] = await Promise.all([
        supabase
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,active,branch_id')
            .eq('biz_id', bizId)
            .eq('active', true)
            .order('name_ru'),
        supabase
            .from('staff')
            .select('id,full_name,is_active,branch_id')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('full_name'),
        supabase
            .from('branches')
            .select('id,name,is_active')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);
    // FE-08: a failed list is an error, not "no masters" / "no services".
    if (services.error) throw services.error;
    if (staff.error) throw staff.error;
    if (branches.error) throw branches.error;
    return {
        services: (services.data ?? []) as ServiceOption[],
        staff: (staff.data ?? []) as StaffOption[],
        branches: (branches.data ?? []) as BranchOption[],
    };
}

export type CalendarBooking = {
    id: string;
    staff_id: string;
    start_at: string;
    end_at: string;
    status: BookingStatus;
    booking_services: { duration_min: number | null; service: { name_ru?: string; name_ky?: string | null; name_en?: string | null } | null }[];
};

/** The day's bookings of the business, cancelled ones left out (the website's day calendar). */
export async function fetchCalendarDay(bizId: string, date: string, timeZone: string | null | undefined): Promise<CalendarBooking[]> {
    const { start, end } = dayRangeInclusive(date, timeZone);
    const { data, error } = await supabase
        .from('bookings')
        .select('id, staff_id, start_at, end_at, status, booking_services ( duration_min, service:services (name_ru, name_ky, name_en) )')
        .eq('biz_id', bizId)
        .neq('status', 'cancelled')
        .gte('start_at', start)
        .lte('start_at', end)
        .order('start_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        staff_id: String(row.staff_id),
        start_at: String(row.start_at),
        end_at: String(row.end_at),
        status: row.status as BookingStatus,
        booking_services: Array.isArray(row.booking_services)
            ? (row.booking_services as CalendarBooking['booking_services'])
            : [],
    }));
}

/** One page of the bookings list (public.dashboard_bookings_page). */
export async function fetchBookingsPage(args: BookingsRpcArgs) {
    const { data, error } = await supabase.rpc('dashboard_bookings_page', args);
    if (error) throw error;
    return parseDashboardBookingsPage(data);
}

/**
 * The signed-in user's staff row in this business only, for the "My master" preset: a manager who
 * is staff elsewhere must not get that business's staff id.
 */
export async function fetchCurrentStaffId(bizId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('staff')
        .select('id')
        .eq('biz_id', bizId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    return (data as { id?: string } | null)?.id ?? null;
}

/** Which master performs which service (active service_staff rows of these masters). */
export async function fetchServiceStaffMap(staffIds: string[]): Promise<Map<string, Set<string>> | null> {
    if (staffIds.length === 0) return null;
    const { data, error } = await supabase
        .from('service_staff')
        .select('service_id,staff_id,is_active')
        .eq('is_active', true)
        .in('staff_id', staffIds);
    if (error) throw error;
    const rows = (data ?? []) as { service_id: string; staff_id: string; is_active: boolean }[];
    if (rows.length === 0) return null;
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
        if (!row.is_active) continue;
        if (!map.has(row.service_id)) map.set(row.service_id, new Set());
        map.get(row.service_id)!.add(row.staff_id);
    }
    return map;
}

export type WorkLocation = { staff_id: string; branch_id: string; date_on: string };

/** Where the masters of the current business work on `date` (the manager's view of the website). */
export async function fetchWorkLocations(bizId: string, date: string): Promise<WorkLocation[]> {
    const query = `bizId=${encodeURIComponent(bizId)}&from=${date}&to=${date}`;
    const response = await apiRequest<{ ok?: boolean; data?: unknown }>(`/api/staff/work-locations?${query}`);
    if (!response?.ok || !Array.isArray(response.data)) throw new Error('Invalid work-location response');
    return (response.data as WorkLocation[]).filter(
        (row) => !!row && typeof row.staff_id === 'string' && typeof row.branch_id === 'string' && typeof row.date_on === 'string',
    );
}

export type DashboardSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

/** Free starts of one service with one master on `day` (the website's getFreeSlotsForServiceDay). */
export async function fetchFreeSlots(params: { bizId: string; serviceId: string; staffId: string; day: string }): Promise<DashboardSlot[]> {
    const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
        p_biz_id: params.bizId,
        p_service_id: params.serviceId,
        p_day: params.day,
        p_per_staff: 400,
        p_step_min: 15,
        p_staff_id: params.staffId,
    });
    if (error) throw error;
    return (data ?? []) as DashboardSlot[];
}

export type FoundUser = { id: string; full_name: string; email: string | null; phone: string | null };

/** Account lookup of QuickDesk (POST /api/users/search): exact contact or the business's own clients. */
export async function searchClients(q: string, signal?: AbortSignal): Promise<FoundUser[]> {
    const response = await apiRequest<{ ok?: boolean; items?: FoundUser[] }>('/api/users/search', {
        method: 'POST',
        body: JSON.stringify({ q }),
        signal,
    });
    if (!response?.ok) throw new Error('SEARCH_FAILED');
    return Array.isArray(response.items) ? response.items : [];
}
