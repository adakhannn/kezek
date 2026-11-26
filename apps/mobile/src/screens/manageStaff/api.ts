import { apiRequest } from '../../lib/api';
import { ensureCurrentBusiness } from '../manage/currentBusiness';
import type {
    AuditLogEntry,
    FoundUser,
    ManagedFinancePayload,
    ScheduleContextPayload,
    ScheduleSnapshot,
    StaffDetailPayload,
    StaffFinanceStatsPayload,
    StaffFinanceStatsPeriod,
    StaffListPayload,
    TimeOff,
    WeekPlan,
} from './types';

type Envelope<T> = { ok?: boolean; data?: T; message?: string; error?: string };

/** A 2xx answer without ok: true is a failure too; its message is the server's text. */
export class StaffCommandError extends Error {
    constructor(message: string, readonly details?: unknown) {
        super(message);
    }
}

function unwrap<T>(response: Envelope<T> | null | undefined, fallback: string): T {
    if (!response?.ok) throw new StaffCommandError(response?.message || response?.error || fallback, response);
    return response.data as T;
}

const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

/**
 * Every call acts on the user's current business on the server (the website's choice): the business
 * opened in the app is made current first, so the app and the website manage the same business.
 */
async function request<T>(bizId: string, path: string, init: RequestInit = {}): Promise<Envelope<T>> {
    await ensureCurrentBusiness(bizId);
    return apiRequest<Envelope<T>>(path, init);
}

const id = (value: string) => encodeURIComponent(value);

export async function fetchStaffList(bizId: string): Promise<StaffListPayload> {
    return unwrap(await request<StaffListPayload>(bizId, '/api/dashboard/staff'), 'staff_list_failed');
}

export async function fetchStaffDetail(bizId: string, staffId: string): Promise<StaffDetailPayload> {
    return unwrap(await request<StaffDetailPayload>(bizId, `/api/dashboard/staff/${id(staffId)}`), 'staff_detail_failed');
}

export async function fetchScheduleContext(bizId: string, staffId: string): Promise<ScheduleContextPayload> {
    return unwrap(await request<ScheduleContextPayload>(bizId, `/api/dashboard/staff/${id(staffId)}/schedule-context`), 'schedule_context_failed');
}

/** The website's dismiss/restore/delete buttons: POST without a body, `{ ok: true }` on success. */
export async function runStaffAction(bizId: string, staffId: string, action: 'dismiss' | 'restore' | 'delete'): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/${action}`, { method: 'POST' }), 'staff_action_failed');
}

export async function cancelStaffInvitation(bizId: string, staffId: string): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/invitation/cancel`, { method: 'POST' }), 'invitation_cancel_failed');
}

export type StaffUpdateBody = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master: number;
    percent_salon: number;
    hourly_rate: number | null;
};

export async function updateStaff(bizId: string, body: StaffUpdateBody): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(body.id)}/update`, json(body)), 'staff_update_failed');
}

export async function transferStaff(bizId: string, staffId: string, targetBranchId: string, expectedBranchId: string): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/transfer`, json({
        target_branch_id: targetBranchId,
        expected_branch_id: expectedBranchId,
    })), 'staff_transfer_failed');
}

export async function searchUsers(bizId: string, q: string): Promise<FoundUser[]> {
    await ensureCurrentBusiness(bizId);
    const response = await apiRequest<{ ok?: boolean; items?: FoundUser[]; error?: string; message?: string }>('/api/users/search', json({ q }));
    if (!response?.ok) throw new StaffCommandError(response?.message || response?.error || 'search_failed');
    return response.items ?? [];
}

export type CreateFromUserResult = { status?: 'pending' | 'already_staff'; staff_id?: string };

export async function createStaffFromUser(bizId: string, input: { userId: string; branchId: string; isActive: boolean }): Promise<CreateFromUserResult> {
    return unwrap(await request<CreateFromUserResult>(bizId, '/api/staff/create-from-user', json({
        user_id: input.userId,
        branch_id: input.branchId,
        is_active: input.isActive,
    })), 'staff_create_failed') ?? {};
}

export async function fetchManagedFinance(bizId: string, staffId: string, date: string | null): Promise<ManagedFinancePayload> {
    const params = new URLSearchParams({ staffId });
    if (date) params.set('date', date);
    const data = unwrap(await request<ManagedFinancePayload>(bizId, `/api/staff/finance?${params.toString()}`), 'finance_load_failed');
    if (!data?.today) throw new StaffCommandError('finance_load_failed');
    return data;
}

export type ShiftVersion = { expectedShiftId: string; expectedRevision: number };
export type WireShiftItem = {
    id?: string;
    clientId?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId: string | null;
};

/** The manager's shift commands, exactly as the website sends them (useFinanceMutations). */
export async function openManagedShift(bizId: string, staffId: string, date: string | null): Promise<void> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    unwrap(await request<unknown>(bizId, `/api/dashboard/staff/${id(staffId)}/shift/open${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }), 'shift_open_failed');
}

export type SavedLedger = { shiftId: string; revision: number; items: WireShiftItem[] };

export async function saveManagedShiftItems(bizId: string, staffId: string, shiftDate: string | null, items: WireShiftItem[], version: ShiftVersion): Promise<SavedLedger> {
    return unwrap(await request<SavedLedger>(bizId, '/api/staff/shift/items', json({
        items, staffId, shiftDate, expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
    })), 'shift_save_failed');
}

export async function closeManagedShift(bizId: string, staffId: string, date: string | null, items: WireShiftItem[], totalAmount: number, version: ShiftVersion): Promise<void> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    unwrap(await request<unknown>(bizId, `/api/dashboard/staff/${id(staffId)}/shift/close${query}`, json({
        items, totalAmount, expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
    })), 'shift_close_failed');
}

export async function fetchFinanceStats(bizId: string, staffId: string, period: StaffFinanceStatsPeriod, dateParam: string | null): Promise<StaffFinanceStatsPayload> {
    const params = new URLSearchParams({ period });
    if (dateParam) params.set('date', dateParam);
    const response = await request<{ stats?: StaffFinanceStatsPayload }>(bizId, `/api/dashboard/staff/${id(staffId)}/finance/stats?${params.toString()}`);
    const legacy = response as Envelope<{ stats?: StaffFinanceStatsPayload }> & { stats?: StaffFinanceStatsPayload };
    if (!legacy?.ok) throw new StaffCommandError(legacy?.message || legacy?.error || 'finance_stats_failed');
    const stats = legacy.data?.stats ?? legacy.stats;
    if (!stats) throw new StaffCommandError('finance_stats_incomplete');
    return stats;
}

export async function updateShiftHours(bizId: string, shiftId: string, hoursWorked: number, expectedRevision: number): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/dashboard/staff-shifts/${id(shiftId)}/update-hours`, json({
        hours_worked: hoursWorked,
        expectedRevision,
    })), 'shift_hours_failed');
}

export async function fetchFinanceAuditLog(bizId: string, staffId: string): Promise<AuditLogEntry[]> {
    const data = unwrap(await request<{ entries?: AuditLogEntry[] }>(bizId, `/api/dashboard/staff/${id(staffId)}/finance/audit-log`), 'audit_log_failed');
    return data?.entries ?? [];
}

/** Explicit scheduling (SCHEDULE_V2_ENABLED): the website's ScheduleEditor and TimeOffEditor. */
export async function fetchScheduleSnapshot(bizId: string, staffId: string, from: string | null): Promise<ScheduleSnapshot> {
    const query = from ? `?from=${encodeURIComponent(from)}` : '';
    return unwrap(await request<ScheduleSnapshot>(bizId, `/api/staff/${id(staffId)}/schedule${query}`), 'schedule_load_failed');
}

export type ScheduleDraft = { revision: number; days: WeekPlan; branchId?: string | null; source?: string };

export async function fetchScheduleDraft(bizId: string, staffId: string, kind: 'week' | 'day', date: string): Promise<ScheduleDraft> {
    const params = new URLSearchParams({ draftKind: kind, draftDate: date });
    return unwrap(await request<ScheduleDraft>(bizId, `/api/staff/${id(staffId)}/schedule?${params.toString()}`), 'schedule_draft_failed');
}

export async function publishSchedule(bizId: string, staffId: string, body: { kind: 'week' | 'day'; from: string; branchId: string; expectedRevision: number; days: WeekPlan }): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/schedule`, json(body)), 'schedule_publish_failed');
}

export async function resetScheduleDay(bizId: string, staffId: string, from: string, expectedRevision: number): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/schedule`, json({ action: 'reset-day', from, expectedRevision })), 'schedule_reset_failed');
}

export type BranchHoursWire = { day_of_week: number; intervals?: { start: string; end: string }[] | null; breaks?: { start: string; end: string }[] | null };

export async function fetchBranchSchedule(bizId: string, branchId: string): Promise<BranchHoursWire[]> {
    const response = await request<{ schedule?: BranchHoursWire[] }>(bizId, `/api/branches/${id(branchId)}/schedule`);
    const legacy = response as Envelope<{ schedule?: BranchHoursWire[] }> & { schedule?: BranchHoursWire[] };
    if (!legacy?.ok) throw new StaffCommandError(legacy?.message || legacy?.error || 'branch_hours_failed');
    return legacy.data?.schedule ?? legacy.schedule ?? [];
}

export async function fetchTimeOff(bizId: string, staffId: string): Promise<{ today: string; items: TimeOff[] }> {
    return unwrap(await request<{ today: string; items: TimeOff[] }>(bizId, `/api/staff/${id(staffId)}/time-off`), 'time_off_failed');
}

export async function createTimeOff(bizId: string, staffId: string, input: { from: string; to: string; reason: string }): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/time-off`, json(input)), 'time_off_save_failed');
}

export async function cancelTimeOff(bizId: string, staffId: string, timeOffId: string): Promise<void> {
    unwrap(await request<unknown>(bizId, `/api/staff/${id(staffId)}/time-off`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: timeOffId }),
    }), 'time_off_save_failed');
}
