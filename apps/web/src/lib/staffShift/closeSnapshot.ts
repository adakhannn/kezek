import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';

import type { ReportClient } from '@/lib/finance/reportSnapshot';
import type { SavedShiftLedgerRow } from '@/lib/staffShift/savedLedger';

export type ShiftCloseSnapshot = {
    shift: { id: string; staff_id: string; biz_id: string; shift_date: string; status: 'open' | 'closed'; opened_at: string | null; ledger_revision: number };
    staff: { percent_master: number | null; percent_salon: number | null; hourly_rate: number | null };
    items: SavedShiftLedgerRow[]; timezone: string; closeBoundary: string; dayStart: string; dayHours: number;
};
export function validateCloseSnapshot(value: unknown): ShiftCloseSnapshot {
    const snapshot = value as ShiftCloseSnapshot | null;
    if (!snapshot?.shift || typeof snapshot.shift.id !== 'string' || !Number.isSafeInteger(snapshot.shift.ledger_revision) || !snapshot.staff ||
        !Array.isArray(snapshot.items) || !Number.isFinite(Date.parse(snapshot.closeBoundary)) || typeof snapshot.timezone !== 'string' || !Number.isFinite(Date.parse(snapshot.dayStart)) || !isShiftDurationWithinDay(null, snapshot.dayHours)) throw new Error('Incomplete shift close snapshot');
    for (const item of snapshot.items) {
        if (!item || typeof item.id !== 'string' || !Number.isFinite(item.service_amount) || !Number.isFinite(item.consumables_amount)) throw new Error('Invalid shift ledger');
    }
    return snapshot;
}
export async function readShiftCloseSnapshot(client: ReportClient, bizId: string, staffId: string, shiftId: string) {
    const { data, error } = await client.rpc('read_staff_shift_close_snapshot', { p_biz_id: bizId, p_staff_id: staffId, p_shift_id: shiftId });
    if (error) throw new Error(error.message);
    const snapshot = validateCloseSnapshot(data);
    if (snapshot.shift.id !== shiftId || snapshot.shift.staff_id !== staffId || snapshot.shift.biz_id !== bizId) throw new Error('Invalid shift close scope');
    return snapshot;
}
export function shiftCloseTime(snapshot: ShiftCloseSnapshot, now: Date): Date {
    const closedAt = new Date(Math.min(now.getTime(), Date.parse(snapshot.closeBoundary)));
    if (snapshot.shift.opened_at && (closedAt.getTime() < Date.parse(snapshot.shift.opened_at) || Date.parse(snapshot.shift.opened_at) < Date.parse(snapshot.dayStart))) throw new Error('needs_review: opened_at is outside the shift day');
    return closedAt;
}
