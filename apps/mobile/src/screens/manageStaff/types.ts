/**
 * The manager's view of staff (the website's /dashboard/staff/*): the JSON the web API returns.
 * Shapes follow apps/web/src/lib/dashboardStaffReadService.ts and the finance/schedule services.
 */

export type StaffRow = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    /** The master's photo; an older server does not send it (initials are shown). */
    avatar_url?: string | null;
    branches: { name: string } | null;
};

/** null: not the owner (the card is hidden); pending null: the count could not be read. */
export type StaffApplicationSummary = { pending: number | null } | null;

export type StaffListPayload = {
    rows: StaffRow[];
    pendingInvitationStaffIds: string[];
    staffApplications: StaffApplicationSummary;
    business: { name: string | null; city: string | null };
};

export type Branch = { id: string; name: string; is_active: boolean };

export type StaffCard = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

export type StaffReview = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    booking_id: string;
    service_name: string | null;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
};

export type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

export type StaffDetailPayload = {
    explicitScheduling: boolean;
    staff: StaffCard;
    branches: Branch[];
    reviews: StaffReview[];
    ratingScore: number | null;
    ratingWeights: RatingWeights | null;
};

export type FoundUser = { id: string; email: string | null; phone: string | null; full_name: string };

export type StaffService = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    branch_id: string;
    active: boolean;
};

export type TimeRange = { start: string; end: string };
export type BranchHoursRow = { day_of_week: number; intervals: TimeRange[] | null };

export type LegacyScheduleContext = {
    usesPublishedSchedule: boolean;
    branchHours: BranchHoursRow[] | null;
    hasRegularSchedule: boolean;
    failed: boolean;
};

export type ScheduleContextPayload = {
    staff: { id: string; full_name: string; branch_id: string };
    branches: { id: string; name: string }[];
    explicitScheduling: boolean;
    legacy: LegacyScheduleContext | null;
    business: { name: string | null; city: string | null };
};

/** One saved date rule of the legacy schedule (staff_schedule_rules, kind = 'date'). */
export type LegacyRule = { id: string; intervals: TimeRange[]; branch_id: string };

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
    ledger_revision: number;
    timezone: string;
    day_hours: number;
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    base_master_share?: number;
    base_salon_share?: number;
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
    totalBaseSalonShare: number;
    totalGuaranteedAmount: number;
    totalTopupAmount?: number;
    hasGuaranteedPayment: boolean;
    shifts: StaffFinanceStatsShift[];
};

export type AuditFieldChange = { field: string; old_value: number | null; new_value: number | null };
export type AuditLogEntry = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    field_changes: AuditFieldChange[];
    message: string | null;
};

/** A shift of GET /api/staff/finance?staffId= (the manager's shift workspace). */
export type ManagedShift = {
    id: string;
    ledger_revision: number;
    shift_date: string;
    opened_at: string | null;
    closed_at: string | null;
    status: 'open' | 'closed';
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    percent_master: number;
    percent_salon: number;
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number;
    topup_amount?: number;
    late_minutes?: number;
};

export type ManagedShiftItem = {
    id?: string;
    clientId?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    createdAt?: string | null;
};

export type FinanceServiceName = { name_ru: string; name_ky?: string | null; name_en?: string | null };

export type FinanceBooking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: FinanceServiceName | FinanceServiceName[] | null;
};

export type ManagedFinancePayload = {
    calendar?: { date: string; timezone: string } | null;
    today: {
        exists: boolean;
        status: 'open' | 'closed' | 'none';
        shift: ManagedShift | null;
        items: ManagedShiftItem[];
    };
    bookings?: FinanceBooking[];
    services?: (FinanceServiceName | string)[];
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
};

/** The explicit (published) schedule model, SCHEDULE_V2_ENABLED. */
export type ScheduleDayPlan = { intervals: TimeRange[]; breaks: TimeRange[] };
export type WeekPlan = Record<string, ScheduleDayPlan>;
export type EffectiveDay = ScheduleDayPlan & {
    date: string;
    branch_id: string | null;
    tz: string;
    source: 'legacy' | 'week' | 'day' | 'absence' | 'unconfigured';
};
export type ScheduleSnapshot = { revision: number; timezone: string; today: string; days: EffectiveDay[] };
export type TimeOff = {
    id: string;
    date_from: string;
    date_to: string;
    reason: string | null;
    created_at: string | null;
    cancelled_at: string | null;
};
