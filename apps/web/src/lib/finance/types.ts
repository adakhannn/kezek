/**
 * Shared types for staff finance statistics (dashboard).
 *
 * These types intentionally mirror the API payload shape (snake_case),
 * because the stats endpoints return raw DB-like fields to the client.
 */

export type StaffFinanceStatsPeriod = 'day' | 'month' | 'year';

export type StaffFinanceStatsShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

export type StaffFinanceStatsShift = {
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    late_minutes: number;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number;
    topup_amount?: number;
    items: StaffFinanceStatsShiftItem[];
};

export type StaffFinanceStatsPayload = {
    period: StaffFinanceStatsPeriod;
    dateFrom: string;
    dateTo: string;
    staffName: string | null;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalClients: number;
    totalBaseMasterShare: number;
    totalGuaranteedAmount: number;
    hasGuaranteedPayment: boolean;
    shifts: StaffFinanceStatsShift[];
};

export type StaffFinanceStatsResponse =
    | { ok: true; stats: StaffFinanceStatsPayload }
    | { ok: false; error: string };

