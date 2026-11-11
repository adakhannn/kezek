import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';

import { calculateShiftFinancials } from '@/lib/financeDomain/shift';
import type { FinanceCommandClient } from '@/lib/staffShift/financeCommand';

export type DashboardShiftHoursAdminLike = FinanceCommandClient;
type Shift = { id: string; biz_id: string; status: string; ledger_revision: number; total_amount: number | null;
    consumables_amount: number | null; percent_master: number | null; percent_salon: number | null; hourly_rate: number | null };
export type UpdateShiftHoursResult = { ok: true; data: { shift: Record<string, unknown> } } |
    { ok: false; error: 'validation' | 'forbidden' | 'not_found' | 'internal'; message: string; status: number };
function failure(error: { code?: string; message?: string }): UpdateShiftHoursResult {
    if (error.code === '42501') return { ok: false, error: 'forbidden', status: 403, message: 'Нет доступа к изменению смены.' };
    if (error.code === 'P0002') return { ok: false, error: 'not_found', status: 404, message: 'Смена не найдена или доступ запрещен' };
    if (error.code === '40001') return { ok: false, error: 'validation', status: 409, message: 'Смена изменилась или переоткрыта. Ваш ввод не применён. Загрузите и проверьте актуальную смену.' };
    if (error.code === '22023' || error.code === '23514') return { ok: false, error: 'validation', status: 400, message: 'Количество часов выходит за границы локального дня смены.' };
    return { ok: false, error: 'internal', status: 500, message: 'Изменение часов не подтверждено. Проверьте состояние смены перед повтором.' };
}
export async function updateDashboardShiftHours({ admin, bizId, shiftId, actorId, hoursWorked, expectedRevision }: {
    admin: DashboardShiftHoursAdminLike; bizId: string; shiftId: string; actorId: string; hoursWorked: number; expectedRevision: number;
}): Promise<UpdateShiftHoursResult> {
    if (!actorId) return failure({ code: '42501' });
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return failure({ code: '40001' });
    const scope = { p_shift_id: shiftId, p_biz_id: bizId, p_actor_id: actorId };
    const { data, error } = await admin.rpc('read_staff_shift_adjustment_snapshot', scope);
    if (error) return failure(error);
    const snapshot = data as { shift?: Shift; dayHours?: number } | null;
    const shift = snapshot?.shift;
    if (!shift || shift.id !== shiftId || shift.biz_id !== bizId || !Number.isSafeInteger(shift.ledger_revision) || !Number.isFinite(snapshot?.dayHours)) return failure({});
    if (shift.status !== 'closed' || shift.ledger_revision !== expectedRevision) return failure({ code: '40001' });
    if (!isShiftDurationWithinDay(hoursWorked, snapshot!.dayHours!)) return failure({ code: '22023' });
    const amounts = [shift.total_amount, shift.consumables_amount, shift.percent_master, shift.percent_salon, shift.hourly_rate];
    if (amounts.some(value => value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))) return failure({});
    const financials = calculateShiftFinancials({ totalAmount: Number(shift.total_amount ?? 0), totalConsumables: Number(shift.consumables_amount ?? 0),
        percentMaster: Number(shift.percent_master ?? 60), percentSalon: Number(shift.percent_salon ?? 40), hoursWorked,
        hourlyRate: shift.hourly_rate === null ? null : Number(shift.hourly_rate) });
    const { data: receipt, error: commitError } = await admin.rpc('adjust_closed_shift_hours_command', {
        ...scope, p_expected_revision: expectedRevision, p_hours_worked: hoursWorked, p_calculation: financials,
    });
    if (commitError) return failure(commitError);
    const confirmed = receipt as { ok?: boolean; shift?: Record<string, unknown> } | null;
    if (!confirmed?.ok || confirmed.shift?.id !== shiftId || confirmed.shift.status !== 'closed' ||
        !Number.isSafeInteger(confirmed.shift.ledger_revision) || Number(confirmed.shift.ledger_revision) <= expectedRevision) return failure({});
    return { ok: true, data: { shift: confirmed.shift } };
}
