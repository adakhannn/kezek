import type { FinanceData, SavedShiftLedger, ShiftCloseCommand, ShiftItem, ShiftItemEdit, ShiftLedgerSnapshot } from './types';
import { getRandomValues } from 'expo-crypto';

import { createTranslate, type Translate } from '../../i18n/translate';

/** Russian texts for callers that pass no `t` (the screen always passes its own). */
const russian: Translate = createTranslate('ru');

export class UnconfirmedShiftCommandError extends Error {}

export function createShiftClientId(): string {
    const bytes = getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function captureShiftLedger(data: FinanceData | null | undefined, t: Translate = russian): ShiftLedgerSnapshot {
    const shift = data?.today.shift;
    if (!shift || shift.status !== 'open' || !Number.isSafeInteger(shift.ledger_revision) || shift.ledger_revision < 0) {
        throw new Error(t('staff.shiftQuick.unknownRevision'));
    }
    return { expectedShiftId: shift.id, expectedRevision: shift.ledger_revision, items: serializeShiftItems(data.today.items) };
}

export function serializeShiftItems(items: ShiftItem[]): ShiftItem[] {
    // note/createdAt are read-only response fields, rejected by the strict command schema.
    return items.map(({ id, clientId, clientName, serviceName, serviceAmount, consumablesAmount, bookingId }) => ({
        ...(id ? { id } : {}), ...(clientId ? { clientId } : {}),
        clientName, serviceName, serviceAmount, consumablesAmount, bookingId: bookingId ?? null,
    }));
}

export function isShiftLedgerSnapshot(value: unknown): value is ShiftLedgerSnapshot {
    if (!value || typeof value !== 'object') return false;
    const data = value as Partial<ShiftLedgerSnapshot>;
    return typeof data.expectedShiftId === 'string' && data.expectedShiftId.length > 0
        && typeof data.expectedRevision === 'number' && Number.isSafeInteger(data.expectedRevision) && data.expectedRevision >= 0
        && Array.isArray(data.items) && data.items.every(item => item && typeof item === 'object'
            && typeof item.clientName === 'string' && typeof item.serviceName === 'string'
            && Number.isFinite(item.serviceAmount) && item.serviceAmount >= 0
            && Number.isFinite(item.consumablesAmount) && item.consumablesAmount >= 0);
}

export function editShiftLedger(edit: ShiftItemEdit, t: Translate = russian): ShiftLedgerSnapshot {
    if (!isShiftLedgerSnapshot(edit.base)) throw new Error(t('staff.shiftQuick.refreshBeforeSave'));
    const items = serializeShiftItems(edit.base.items);
    if (edit.itemId) {
        const index = items.findIndex(item => item.id === edit.itemId);
        if (index < 0) throw new Error(t('staff.shiftQuick.clientGone'));
        if (items[index].bookingId) throw new Error(t('staff.shiftQuick.bookingRowReadOnly'));
        items[index] = { ...items[index], ...edit.item, id: edit.itemId };
    } else {
        items.push({ ...edit.item });
    }
    return { ...edit.base, items: serializeShiftItems(items) };
}

export function closeShiftLedger(base: ShiftLedgerSnapshot, t: Translate = russian): ShiftCloseCommand {
    if (!isShiftLedgerSnapshot(base)) throw new Error(t('staff.shiftQuick.refreshBeforeClose'));
    const items = serializeShiftItems(base.items);
    return { ...base, items, totalAmount: items.reduce((sum, item) => sum + item.serviceAmount, 0),
        consumablesAmount: items.reduce((sum, item) => sum + item.consumablesAmount, 0) };
}

export function readSavedLedger(response: unknown, expected: ShiftLedgerSnapshot, t: Translate = russian): SavedShiftLedger {
    const result = response as { ok?: boolean; data?: SavedShiftLedger } | null;
    const data = result?.data;
    if (!result?.ok || !data || data.shiftId !== expected.expectedShiftId
        || !Number.isSafeInteger(data.revision) || data.revision <= expected.expectedRevision
        || !isShiftLedgerSnapshot({ expectedShiftId: data.shiftId, expectedRevision: data.revision, items: data.items })
        || data.items.some(item => typeof item.id !== 'string' || !item.id)) {
        throw new UnconfirmedShiftCommandError(t('staff.shiftQuick.unconfirmed'));
    }
    return { ...data, items: serializeShiftItems(data.items) };
}

export function applySavedLedger(current: FinanceData, saved: SavedShiftLedger, t: Translate = russian): FinanceData {
    if (current.today.shift?.id !== saved.shiftId) throw new Error(t('staff.shiftQuick.changedWhileSaving'));
    return { ...current, today: { ...current.today, items: saved.items, shift: {
        ...current.today.shift, ledger_revision: saved.revision,
        total_amount: saved.items.reduce((sum, item) => sum + item.serviceAmount, 0),
        consumables_amount: saved.items.reduce((sum, item) => sum + item.consumablesAmount, 0),
    } } };
}

export function errorStatus(error: unknown): number | undefined {
    return error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}
