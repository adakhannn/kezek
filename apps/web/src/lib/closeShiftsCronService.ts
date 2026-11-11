import { randomUUID } from 'node:crypto';

import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';
import { validateCloseSnapshot, shiftCloseTime, type ShiftCloseSnapshot } from '@/lib/staffShift/closeSnapshot';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { commitShiftClose } from '@/lib/staffShift/financeCommand';
import { deadlineFinanceClient } from '@/lib/staffShift/rpcDeadline';
import { savedShiftLedgerItems } from '@/lib/staffShift/savedLedger';

type Client = Pick<SupabaseClient, 'rpc'>;
type Summary = { closed: number; total: number; attempted: number; pending: number; hasMore: boolean; errors: string[] };
type Result =
    | { ok: true; data: Summary & { ok: true; message: string } }
    | { ok: false; status: 500; error: 'internal'; message: string; details?: Summary };
export const CLOSE_SHIFTS_BATCH_SIZE = 25;
export const CLOSE_SHIFTS_BUDGET_MS = 45_000;

export async function runCloseShiftsCron({ supabase, now = new Date(), clock = Date.now }: {
    supabase: Client; now?: Date; clock?: () => number;
}): Promise<Result> {
    const started = clock();
    const deadline = Date.now() + CLOSE_SHIFTS_BUDGET_MS;
    const bounded = deadlineFinanceClient(supabase, deadline, 10_000);
    const claimToken = randomUUID();
    const { data, error } = await bounded.rpc('claim_overdue_staff_shifts', {
        p_claim_token: claimToken, p_limit: CLOSE_SHIFTS_BATCH_SIZE, p_now: now.toISOString(),
    });
    const batch = data as { rows?: ShiftCloseSnapshot[]; hasMore?: boolean; configurationErrors?: string[] } | null;
    if (error || !batch || !Array.isArray(batch.rows) || batch.rows.length > CLOSE_SHIFTS_BATCH_SIZE || typeof batch.hasMore !== 'boolean') {
        logError('CloseShiftsCron', 'Failed to claim overdue shifts', error);
        return { ok: false, status: 500, error: 'internal', message: 'Failed to read complete overdue shift batch' };
    }
    const rows: ShiftCloseSnapshot[] = batch.rows;
    const summary: Summary = { closed: 0, total: rows.length, attempted: 0, pending: 0, hasMore: batch.hasMore, errors: Array.isArray(batch.configurationErrors) ? batch.configurationErrors.map(String) : [] };
    for (const row of rows) {
        if (clock() - started >= CLOSE_SHIFTS_BUDGET_MS) break;
        summary.attempted += 1;
        try {
            const snapshot = validateCloseSnapshot(row);
            await closeSingleShift(bounded, snapshot, now);
            summary.closed += 1;
        } catch (error) {
            const message = String(row?.shift?.id ?? 'invalid_snapshot') + ': ' + (error instanceof Error ? error.message : 'close_failed');
            summary.errors.push(message);
            logError('CloseShiftsCron', 'Overdue shift closure unconfirmed', { shiftId: row?.shift?.id, error: message });
        }
    }
    const untouched = rows.slice(summary.attempted).map(row => row.shift.id);
    summary.pending = untouched.length;
    summary.hasMore ||= summary.pending > 0;
    if (untouched.length) {
        const { error: releaseError } = await deadlineFinanceClient(supabase, deadline, 3_000).rpc('release_staff_shift_claims', { p_claim_token: claimToken, p_shift_ids: untouched });
        if (releaseError) summary.errors.push('claim_release_failed: ' + releaseError.message);
    }
    if (summary.errors.length) return { ok: false, status: 500, error: 'internal', message: 'Some overdue shifts require retry or review', details: summary };
    return { ok: true, data: { ok: true, message: 'Closed ' + summary.closed + ' of ' + summary.total + ' claimed shifts', ...summary } };
}

async function closeSingleShift(supabase: ReturnType<typeof deadlineFinanceClient>, snapshot: ShiftCloseSnapshot, now: Date): Promise<void> {
    const { shift, staff, items } = snapshot;
    const closedAt = shiftCloseTime(snapshot, now);
    const decision = closeStaffShiftUseCase({ now: closedAt,
        staff: { percentMaster: staff.percent_master, percentSalon: staff.percent_salon, hourlyRate: staff.hourly_rate },
        shift, items: savedShiftLedgerItems(items), totalAmountRaw: 0, consumablesAmountRaw: 0,
    });
    if (decision.kind !== 'ok') throw new Error('shift_not_open');
    if (!isShiftDurationWithinDay(decision.hoursWorked, snapshot.dayHours)) throw new Error('needs_review: shift hours outside local financial day');
    // SQL close checks empty-ledger bookings, totals, revision and staff settings in
    // the same transaction as attendance and finance writes. No separate capped read.
    const { data: result, error } = await commitShiftClose({
        client: supabase, shiftId: shift.id, actorId: null, revision: shift.ledger_revision,
        staff, financials: decision.financials, hoursWorked: decision.hoursWorked, closedAt: closedAt.toISOString(),
    });
    if (error) throw new Error((error.code ?? 'database_error') + ': ' + (error.message ?? 'atomic_close_failed'));
    if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) throw new Error('atomic_close_unconfirmed');
}
