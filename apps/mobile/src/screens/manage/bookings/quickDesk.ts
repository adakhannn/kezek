import { filterServicesForStaff, resolveScheduleContext, type TemporaryTransfer } from '@core-domain/schedule';
import { validateName, validatePhone } from '@shared-client/validation';

import type { Translate } from '../../../i18n';
import { apiRequest } from '../../../lib/api';
import { acknowledgeBookingRequest, getBookingRequestKey } from '../../../lib/bookingRequest';
import { supabase } from '../../../lib/supabase';
import type { FoundUser, ServiceOption, StaffOption, WorkLocation } from './bookingsData';

/*
 * QuickDesk of the website (/dashboard/bookings, tab "QuickDesk"): an internal booking made by
 * the business for a client at the desk, through POST /api/bookings/internal with an
 * Idempotency-Key kept until the server confirms (web internalBookingClient).
 */

export type ClientMode = 'none' | 'existing' | 'new';

export type ClientState = {
    mode: ClientMode;
    selectedClientId: string;
    foundUsers: FoundUser[];
    searchLoading: boolean;
    newClientName: string;
    newClientPhone: string;
};

export type ClientPayload = { clientId: string | null; clientName: string | null; clientPhone: string | null };

/** The client part of the booking, checked as the website checks it (useQuickDeskClient). */
export function quickDeskClientPayload(state: ClientState, t: Translate):
    | { ok: true; payload: ClientPayload }
    | { ok: false; error: string } {
    if (state.mode === 'none') return { ok: true, payload: { clientId: null, clientName: null, clientPhone: null } };
    if (state.mode === 'existing') {
        if (state.searchLoading || !state.foundUsers.some((user) => user.id === state.selectedClientId)) {
            return { ok: false, error: t('ops.desk.errors.selectClient') };
        }
        return { ok: true, payload: { clientId: state.selectedClientId, clientName: null, clientPhone: null } };
    }
    const name = state.newClientName.trim();
    const phone = state.newClientPhone.trim();
    if (!validateName(name, true).valid) {
        return { ok: false, error: t(name ? 'ops.desk.errors.nameLength' : 'ops.desk.errors.nameRequired') };
    }
    if (!validatePhone(phone, true).valid) {
        return { ok: false, error: t('ops.desk.errors.phoneRequired') };
    }
    return { ok: true, payload: { clientId: null, clientName: name, clientPhone: phone } };
}

/** Whether the client part allows the "Create booking" button (website canSubmitClient). */
export function canSubmitClient(state: ClientState): boolean {
    if (state.mode === 'none') return true;
    if (state.mode === 'existing') return !state.searchLoading && state.foundUsers.some((user) => user.id === state.selectedClientId);
    return !!state.newClientName.trim() && !!state.newClientPhone.trim();
}

/** Masters at another branch than their home one that day (web useTemporaryTransfers). */
export function temporaryTransfersFor(locations: WorkLocation[], staff: StaffOption[]): TemporaryTransfer[] {
    const homes = new Map(staff.map((member) => [member.id, member.branch_id]));
    return locations
        .filter((row) => homes.has(row.staff_id) && row.branch_id !== homes.get(row.staff_id))
        .map((row) => ({ staff_id: row.staff_id, branch_id: row.branch_id, date: row.date_on }));
}

/** Masters who work in `branchId` on `date`: home masters not sent elsewhere, plus visitors. */
export function staffWorkingInBranch(staff: StaffOption[], branchId: string, date: string, transfers: TemporaryTransfer[]): StaffOption[] {
    const staffInfo = staff.map((member) => ({ id: member.id, branch_id: member.branch_id }));
    return staff.filter((member) => {
        const context = resolveScheduleContext({
            staffId: member.id, dayStr: date, selectedBranchId: branchId, temporaryTransfers: transfers, staff: staffInfo,
        });
        return (context.isTemporaryTransfer ? context.targetBranchId : context.homeBranchId) === branchId;
    });
}

/** The services the chosen master performs where they work that day (web filterServicesForStaff). */
export function servicesForMaster(params: {
    services: ServiceOption[];
    staff: StaffOption[];
    staffId: string;
    branchId: string;
    date: string;
    transfers: TemporaryTransfer[];
    serviceToStaffMap: Map<string, Set<string>> | null;
}): ServiceOption[] {
    const { services, staff, staffId, branchId, date, transfers, serviceToStaffMap } = params;
    if (!staffId || !branchId || !date) return [];
    const context = resolveScheduleContext({
        staffId, dayStr: date, selectedBranchId: branchId, temporaryTransfers: transfers,
        staff: staff.map((member) => ({ id: member.id, branch_id: member.branch_id })),
    });
    const allowed = filterServicesForStaff({
        services,
        targetBranchId: context.targetBranchId,
        staffId,
        serviceToStaffMap,
        isTemporaryTransfer: context.isTemporaryTransfer,
    });
    const ids = new Set(allowed.map((service) => service.id));
    return services.filter((service) => ids.has(service.id));
}

/** The branch the booking belongs to: the master's branch of that day (a visit counts there). */
export function targetBranchFor(staff: StaffOption[], staffId: string, branchId: string, date: string, transfers: TemporaryTransfer[]): string {
    return resolveScheduleContext({
        staffId, dayStr: date, selectedBranchId: branchId, temporaryTransfers: transfers,
        staff: staff.map((member) => ({ id: member.id, branch_id: member.branch_id })),
    }).targetBranchId;
}

/** The body of POST /api/bookings/internal, mode "simple" (web createInternalBooking). */
export type InternalBookingInput = {
    mode: 'simple';
    biz_id: string;
    branch_id: string;
    staff_id: string;
    service_id: string;
    start_at: string;
    duration_min: number;
    client_id: string | null;
    client_name: string | null;
    client_phone: string | null;
};

export function internalBookingInput(params: {
    bizId: string;
    branchId: string;
    staffId: string;
    serviceId: string;
    startAt: string;
    durationMin: number;
    client: ClientPayload;
}): InternalBookingInput {
    return {
        mode: 'simple',
        biz_id: params.bizId,
        branch_id: params.branchId,
        staff_id: params.staffId,
        service_id: params.serviceId,
        start_at: params.startAt,
        duration_min: params.durationMin,
        client_id: params.client.clientId,
        client_name: params.client.clientName,
        client_phone: params.client.clientPhone,
    };
}

type InternalBookingResponse = { ok?: boolean; data?: { booking_id?: unknown; confirmed?: unknown } };

/**
 * Creates the booking. The request identity is persisted before the request and bound to the
 * signed-in account: a retry after a lost answer replays the same request instead of booking
 * twice; a confirmed answer ends the attempt.
 */
export async function createInternalBooking(input: InternalBookingInput, t: Translate): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error(t('ops.desk.errors.signInRequired'));
    const identityInput = { kind: 'internal', payload: input };
    const requestId = await getBookingRequestKey(userId, identityInput);
    const response = await apiRequest<InternalBookingResponse>('/api/bookings/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
        body: JSON.stringify(input),
    });
    if (response?.ok !== true || response.data?.confirmed !== true || typeof response.data?.booking_id !== 'string') {
        throw new Error(t('ops.desk.errors.unconfirmed'));
    }
    try { await acknowledgeBookingRequest(userId, identityInput, requestId); } catch { /* A kept key safely replays the receipt. */ }
    return response.data.booking_id;
}
