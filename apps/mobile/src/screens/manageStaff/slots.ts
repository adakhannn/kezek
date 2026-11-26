import { validateName, validatePhone } from '@shared-client/validation';

import type { MobileI18nKey } from '../../i18n';
import type { FoundUser } from './types';

/**
 * The client of a booking made from the staff's free slots (the website's QuickDesk client
 * section, FE-12): none (an openly chosen walk-in), an existing account found by search, or a new
 * client by name and phone.
 */
export type SlotClientMode = 'none' | 'existing' | 'new';

export type SlotClientState = {
    mode: SlotClientMode;
    selectedClientId: string;
    foundUsers: FoundUser[];
    searchLoading: boolean;
    newClientName: string;
    newClientPhone: string;
};

export type SlotClientPayload = { clientId: string | null; clientName: string | null; clientPhone: string | null };

export type SlotClientResult = { ok: true; payload: SlotClientPayload } | { ok: false; error: MobileI18nKey };

export function slotClientPayload(state: SlotClientState): SlotClientResult {
    if (state.mode === 'none') return { ok: true, payload: { clientId: null, clientName: null, clientPhone: null } };
    if (state.mode === 'existing') {
        if (state.searchLoading || !state.foundUsers.some((user) => user.id === state.selectedClientId)) {
            return { ok: false, error: 'manageStaff.bookings.desk.errors.selectClient' };
        }
        return { ok: true, payload: { clientId: state.selectedClientId, clientName: null, clientPhone: null } };
    }
    const name = state.newClientName.trim();
    const phone = state.newClientPhone.trim();
    if (!validateName(name, true).valid) return { ok: false, error: 'manageStaff.bookings.desk.errors.nameRequired' };
    if (!validatePhone(phone, true).valid) return { ok: false, error: 'manageStaff.bookings.desk.errors.phoneRequired' };
    return { ok: true, payload: { clientId: null, clientName: name, clientPhone: phone } };
}

/** The confirm button is enabled only when the chosen client is complete enough to try. */
export function canSubmitSlotClient(state: SlotClientState): boolean {
    return state.mode === 'none'
        || (state.mode === 'existing' && !state.searchLoading && state.foundUsers.some((user) => user.id === state.selectedClientId))
        || (state.mode === 'new' && !!state.newClientName.trim() && !!state.newClientPhone.trim());
}

/** The body of POST /api/bookings/internal for one service (createInternalBooking, mode simple). */
export function internalBookingInput(input: {
    bizId: string;
    branchId: string;
    staffId: string;
    serviceId: string;
    startAt: string;
    minutes: number;
    client: SlotClientPayload;
}) {
    return {
        mode: 'simple' as const,
        biz_id: input.bizId,
        branch_id: input.branchId,
        staff_id: input.staffId,
        service_id: input.serviceId,
        start_at: input.startAt,
        duration_min: input.minutes,
        client_id: input.client.clientId,
        client_name: input.client.clientName,
        client_phone: input.client.clientPhone,
    };
}

type RawSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

/** One slot per start time (the RPC may return the same start twice). */
export function uniqueSlots<T extends RawSlot>(slots: T[]): T[] {
    return Array.from(new Map(slots.map((slot) => [slot.start_at, slot])).values());
}
