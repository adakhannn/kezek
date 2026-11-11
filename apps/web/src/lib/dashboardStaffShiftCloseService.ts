import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performanceServer';
import { readShiftCloseSnapshot, shiftCloseTime } from '@/lib/staffShift/closeSnapshot';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { commitShiftClose, financeCommandFailure } from '@/lib/staffShift/financeCommand';
import { matchesSavedShiftLedger, savedShiftLedgerItems } from '@/lib/staffShift/savedLedger';
import { validateRequest } from '@/lib/validation/apiValidation';
import { closeShiftSchema, dateStringSchema } from '@/lib/validation/schemas';

type StaffShiftRow = {
    id: string;
    ledger_revision: number;
    staff_id: string;
    biz_id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number | null;
    consumables_amount: number | null;
    percent_master: number | null;
    percent_salon: number | null;
    master_share: number | null;
    salon_share: number | null;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number | null;
    topup_amount: number | null;
};

type CloseStaffShiftRpcResult = {
    ok: boolean;
    error?: string | null;
    action?: string | null;
    shift?: StaffShiftRow | null;
};

type Result =
    | { ok: false; statusCode: number; errorType: 'validation' | 'internal' | 'not_found' | 'forbidden'; message: string }
    | { ok: true; shift: StaffShiftRow };

export async function runDashboardStaffShiftClose({
    req,
    admin,
    bizId,
    staffId,
    actorId,
}: {
    req: Request;
    admin: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
    bizId: string;
    staffId: string;
    actorId: string;
}): Promise<Result> {
    const { data: staff, error: staffError } = await admin
        .from('staff')
        .select('id, biz_id, full_name, percent_master, percent_salon, hourly_rate, user_id')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('DashboardStaffShiftClose', 'Error loading staff', staffError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'Не удалось загрузить данные сотрудника',
        };
    }

    if (!staff) {
        return {
            ok: false,
            statusCode: 404,
            errorType: 'not_found',
            message: 'Сотрудник не найден или доступ запрещён',
        };
    }

    const normalizedBizId = bizId ? String(bizId).trim() : null;
    const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;
    if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
        logError('DashboardStaffShiftClose', 'Staff business mismatch', {
            staffId,
            staffBizId: normalizedStaffBizId,
            requestedBizId: normalizedBizId,
        });
        return {
            ok: false,
            statusCode: 403,
            errorType: 'forbidden',
            message: 'Сотрудник не принадлежит этому бизнесу',
        };
    }

    const ymdResult = resolveShiftDate(req);
    if (!ymdResult.ok) {
        return ymdResult;
    }

    const validationResult = await validateRequest(req, closeShiftSchema);
    if (!validationResult.success) {
        const errorResponse = await validationResult.response.json();
        const errorMessage =
            (errorResponse as { errors?: Array<{ path: string; message: string }> }).errors
                ? `Ошибка валидации: ${(errorResponse as { errors: Array<{ path: string; message: string }> }).errors.map((entry) => `${entry.path}: ${entry.message}`).join(', ')}`
                : (errorResponse as { message?: string }).message || 'Ошибка валидации данных';
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: errorMessage,
        };
    }

    const { items = [], totalAmount: totalAmountRaw = 0, consumablesAmount = 0, expectedShiftId, expectedRevision } = validationResult.data;
    const now = new Date();

    const { data: existing, error: loadError } = await admin
        .from('staff_shifts')
        .select('*')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('id', expectedShiftId)
        .maybeSingle();

    if (loadError) {
        logError('DashboardStaffShiftClose', 'Error loading shift', loadError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'Не удалось загрузить смену',
        };
    }

    if (!existing) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Смена на выбранную дату не открыта. Сначала откройте смену.',
        };
    }

    if (ymdResult.ymd && existing.shift_date !== ymdResult.ymd) return financeCommandFailure({ code: '40001' });
    if (!actorId) return financeCommandFailure({ code: '42501' });
    if (existing.id !== expectedShiftId) return financeCommandFailure({ code: '40001' });
    if (existing.status === 'closed') return { ok: true, shift: existing };
    if (existing.ledger_revision !== expectedRevision) return financeCommandFailure({ code: '40001' });

    // Owner and staff closure both finalize the same persisted ledger.
    let snapshot;
    try { snapshot = await readShiftCloseSnapshot(admin, bizId, staffId, existing.id); }
    catch (error) {
        logError('DashboardStaffShiftClose', 'Error loading complete shift ledger', error);
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Не удалось загрузить полный список клиентов смены.' };
    }
    if (snapshot.shift.ledger_revision !== expectedRevision || snapshot.shift.status !== 'open') return financeCommandFailure({ code: '40001' });
    let financialCloseTime;
    try { financialCloseTime = shiftCloseTime(snapshot, now); }
    catch { return { ok: false, statusCode: 409, errorType: 'validation', message: 'Время открытия вне дня смены. Требуется проверка.' }; }
    const savedItems = savedShiftLedgerItems(snapshot.items);
    if (!matchesSavedShiftLedger(items, savedItems)) {
        return {
            ok: false, statusCode: 409, errorType: 'validation',
            message: 'Список клиентов изменился или ещё не сохранён. Сохраните клиентов и обновите смену перед закрытием.',
        };
    }

    const closedAt = financialCloseTime.toISOString();
    const decision = closeStaffShiftUseCase({
        now: financialCloseTime,
        staff: {
            percentMaster: snapshot.staff.percent_master,
            percentSalon: snapshot.staff.percent_salon,
            hourlyRate: snapshot.staff.hourly_rate,
        },
        shift: snapshot.shift,
        items: savedItems,
        totalAmountRaw,
        consumablesAmountRaw: consumablesAmount,
    });

    if (decision.kind === 'no_shift') {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Смена на выбранную дату не открыта. Сначала откройте смену.',
        };
    }

    if (decision.kind === 'already_closed') {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Смена уже закрыта. Обновите страницу для просмотра результатов.',
        };
    }

    const { hoursWorked, financials } = decision;
    if (!isShiftDurationWithinDay(hoursWorked, snapshot.dayHours)) return { ok: false, statusCode: 409, errorType: 'validation', message: 'Часы превышают длину локального дня смены.' };

    const { data: rpcResult, error: rpcError } = await measurePerformance(
        'shift_close_dashboard',
        async () =>
            commitShiftClose({
                client: admin, shiftId: existing.id, actorId, revision: expectedRevision,
                staff: snapshot.staff, financials, hoursWorked, closedAt,
            }),
        { shiftId: existing.id, staffId, itemsCount: items.length },
    );

    if (rpcError) {
        logError('DashboardStaffShiftClose', 'Atomic close failed', rpcError);
        return financeCommandFailure(rpcError);
    }

    const typedResult = rpcResult as CloseStaffShiftRpcResult | null;
    if (!typedResult?.ok) {
        const message = typedResult?.error || 'Не удалось закрыть смену';
        logError('DashboardStaffShiftClose', 'RPC returned error', { error: message, result: rpcResult });
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message,
        };
    }

    if (!typedResult.shift) {
        logError('DashboardStaffShiftClose', 'RPC returned ok but no shift data', rpcResult);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'Смена закрыта, но не удалось получить обновлённые данные. Обновите страницу.',
        };
    }

    const updated = typedResult.shift;
    if (typedResult.action !== 'already_closed') await queueShiftCloseNotification({
        admin,
        bizId,
        ymd: existing.shift_date,
        staff,
        financials,
        itemsCount: items.length,
        hoursWorked: hoursWorked ?? 0,
    }).catch((error) => logError('DashboardStaffShiftClose', 'Notification failed after committed close', error));

    return {
        ok: true,
        shift: updated as StaffShiftRow,
    };
}

function resolveShiftDate(req: Request):
    | { ok: true; ymd: string | null }
    | { ok: false; statusCode: 400; errorType: 'validation'; message: string } {
    const dateParam = new URL(req.url).searchParams.get('date');
    if (!dateParam) {
        return { ok: true, ymd: null };
    }

    const parsed = dateStringSchema.safeParse(dateParam);
    if (!parsed.success) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Неверный формат даты. Ожидается YYYY-MM-DD.',
        };
    }

    return { ok: true, ymd: parsed.data };
}

async function queueShiftCloseNotification({
    admin,
    bizId,
    ymd,
    staff,
    financials,
    itemsCount,
    hoursWorked,
}: {
    admin: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
    bizId: string;
    ymd: string;
    staff: { full_name?: string | null; user_id?: string | null };
    financials: {
        totalAmount: number;
        finalMasterShare: number;
        finalSalonShare: number;
        guaranteedAmount: number;
        topupAmount: number;
    };
    itemsCount: number;
    hoursWorked: number;
}) {
    let staffEmail: string | null = null;
    if (staff.user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(staff.user_id);
        staffEmail = userData?.user?.email || null;
    }

    let ownerEmail: string | null = null;
    const { data: ownerData } = await admin.from('businesses').select('owner_id').eq('id', bizId).maybeSingle();
    if (ownerData?.owner_id) {
        const { data: ownerUserData } = await admin.auth.admin.getUserById(ownerData.owner_id);
        ownerEmail = ownerUserData?.user?.email || null;
    }

    if (!staffEmail) {
        return;
    }

    sendShiftCloseNotification({
        staffName: staff.full_name || 'Сотрудник',
        staffEmail,
        ownerEmail,
        shiftDate: ymd,
        totalAmount: financials.totalAmount,
        masterShare: financials.finalMasterShare,
        salonShare: financials.finalSalonShare,
        itemsCount,
        hoursWorked,
        guaranteedAmount: financials.guaranteedAmount,
        topupAmount: financials.topupAmount,
    }).catch((error) => {
        logError('DashboardStaffShiftClose', 'Failed to send shift close notification', error);
    });
}

