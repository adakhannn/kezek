import { supabase } from '@/lib/supabaseClient';

/** One page of the dashboard bookings list (FE-03): filters, search over the whole history and the total of matches. */
export const DASHBOARD_BOOKINGS_PAGE_SIZE = 30;

export type DashboardBookingsPreset = 'today' | 'myStaff' | 'holdConfirmed' | null;

export type DashboardBookingsSelection = {
    bizId: string;
    /** 'all' (every status except cancelled), 'active' (confirmed) or one booking status. */
    statusFilter: string;
    /** 'all' or a branch id. */
    branchFilter: string;
    preset: DashboardBookingsPreset;
    search: string;
    page: number;
    /** The business day for the 'today' preset, as instants [start, end). */
    todayBounds: { start: Date; end: Date } | null;
    /** The staff row of the signed-in user in this business, for the 'myStaff' preset. */
    currentStaffId: string | null;
};

export type DashboardBookingsRpcArgs = {
    p_biz_id: string;
    p_status: string;
    p_branch_id?: string;
    p_staff_id?: string;
    p_start_from?: string;
    p_start_before?: string;
    p_search?: string;
    p_limit: number;
    p_offset: number;
};

type ServiceNames = { name_ru: string; name_ky: string | null; name_en: string | null };

export type DashboardBookingRow = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    start_at: string;
    end_at: string;
    branch_id: string | null;
    staff_id: string | null;
    client_id: string | null;
    client_name: string | null;
    client_phone: string | null;
    service: ServiceNames | null;
    staff_name: string | null;
    booking_services: Array<{ duration_min: number | null; service: ServiceNames | null }>;
};

/** The arguments of public.dashboard_bookings_page for what the manager selected. */
export function dashboardBookingsRpcArgs(selection: DashboardBookingsSelection): DashboardBookingsRpcArgs {
    const page = Math.max(1, Math.floor(selection.page) || 1);
    const args: DashboardBookingsRpcArgs = {
        p_biz_id: selection.bizId,
        p_status: 'notCancelled',
        p_limit: DASHBOARD_BOOKINGS_PAGE_SIZE,
        p_offset: (page - 1) * DASHBOARD_BOOKINGS_PAGE_SIZE,
    };
    const search = selection.search.trim().slice(0, 100);
    if (search) args.p_search = search;
    if (selection.branchFilter !== 'all') args.p_branch_id = selection.branchFilter;

    if (selection.preset) {
        // A preset replaces the status select, as before: 'today' and 'myStaff' include cancelled bookings.
        args.p_status = selection.preset === 'holdConfirmed' ? 'holdConfirmed' : 'any';
        if (selection.preset === 'today' && selection.todayBounds) {
            args.p_start_from = selection.todayBounds.start.toISOString();
            args.p_start_before = selection.todayBounds.end.toISOString();
        }
        if (selection.preset === 'myStaff' && selection.currentStaffId) args.p_staff_id = selection.currentStaffId;
    } else if (selection.statusFilter === 'active') {
        args.p_status = 'confirmed';
    } else if (selection.statusFilter !== 'all') {
        args.p_status = selection.statusFilter;
    }
    return args;
}

const isTextOrNull = (value: unknown) => value === null || value === undefined || typeof value === 'string';

/** Checks the JSON of dashboard_bookings_page; the generated type is only Json. */
export function parseDashboardBookingsPage(data: unknown): { total: number; rows: DashboardBookingRow[] } {
    const value = (data ?? {}) as { total?: unknown; rows?: unknown };
    if (typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total < 0 || !Array.isArray(value.rows)) {
        throw new Error('Unexpected dashboard_bookings_page payload');
    }
    const rows = value.rows.map((raw) => {
        const row = (raw ?? {}) as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.status !== 'string' || typeof row.start_at !== 'string'
            || typeof row.end_at !== 'string' || !isTextOrNull(row.client_name) || !isTextOrNull(row.client_phone)
            || !isTextOrNull(row.staff_name) || (row.booking_services !== undefined && !Array.isArray(row.booking_services))) {
            throw new Error('Unexpected dashboard_bookings_page row');
        }
        return {
            ...row,
            branch_id: (row.branch_id as string | null | undefined) ?? null,
            staff_id: (row.staff_id as string | null | undefined) ?? null,
            client_id: (row.client_id as string | null | undefined) ?? null,
            client_name: (row.client_name as string | null | undefined) ?? null,
            client_phone: (row.client_phone as string | null | undefined) ?? null,
            service: (row.service as ServiceNames | null | undefined) ?? null,
            staff_name: (row.staff_name as string | null | undefined) ?? null,
            booking_services: (row.booking_services as DashboardBookingRow['booking_services'] | undefined) ?? [],
        } as DashboardBookingRow;
    });
    return { total: value.total, rows };
}

export async function fetchDashboardBookingsPage(args: DashboardBookingsRpcArgs, signal: AbortSignal) {
    const { data, error } = await supabase.rpc('dashboard_bookings_page', args).abortSignal(signal);
    if (error) throw error;
    return parseDashboardBookingsPage(data);
}
