import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performanceServer';
import { readShiftCloseSnapshot, shiftCloseTime } from '@/lib/staffShift/closeSnapshot';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { commitShiftClose, financeCommandFailure } from '@/lib/staffShift/financeCommand';
import { matchesSavedShiftLedger, savedShiftLedgerItems } from '@/lib/staffShift/savedLedger';
import { getServiceClient } from '@/lib/supabaseService';

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

type ShiftItemInput = {
    id?: string | null;
    clientName?: string | null;
    client_name?: string | null;
    serviceName?: string | null;
    service_name?: string | null;
    serviceAmount?: number | null;
    amount?: number | null;
    consumablesAmount?: number | null;
    consumables_amount?: number | null;
    bookingId?: string | null;
    booking_id?: string | null;
    note?: string | null;
};

type ServiceResult =
    | { ok: false; statusCode: number; errorType: 'validation' | 'internal' | 'forbidden'; message: string }
    | { ok: true; shift: StaffShiftRow };

async function queueShiftCloseNotification(params: {
    admin: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
    bizId: string;
    ymd: string;
    staffData: {
        full_name?: string | null;
        user_id?: string | null;
    } | null;
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
    const { admin, bizId, ymd, staffData, financials, itemsCount, hoursWorked } = params;

    let staffEmail: string | null = null;
    if (staffData?.user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(staffData.user_id);
        staffEmail = userData?.user?.email || null;
    }

    let ownerEmail: string | null = null;
    const { data: ownerData } = await admin
        .from('businesses')
        .select('owner_id')
        .eq('id', bizId)
        .maybeSingle();

    if (ownerData?.owner_id) {
        const { data: ownerUserData } = await admin.auth.admin.getUserById(ownerData.owner_id);
        ownerEmail = ownerUserData?.user?.email || null;
    }

    if (!staffEmail) {
        return;
    }

    sendShiftCloseNotification({
        staffName: staffData?.full_name || 'Сотрудник',
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
        logError('StaffShiftCloseService', 'Failed to send shift close notification', error);
    });
}

export async function runStaffShiftClose(params: {
    supabase: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
    staffId: string;
    bizId: string;
    actorId: string;
    expectedShiftId: string;
    expectedRevision: number;
    items?: ShiftItemInput[];
    totalAmountRaw?: number;
    consumablesAmount?: number;
}): Promise<ServiceResult> {
    const {
        supabase,
        staffId,
        bizId,
        actorId,
        items = [],
        totalAmountRaw = 0,
        consumablesAmount = 0,
    } = params;

    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('percent_master, percent_salon, hourly_rate, full_name, user_id')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffShiftCloseService', 'Error loading staff for percent', staffError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message:
                'Не удалось загрузить настройки сотрудника. Проверьте подключение к интернету и попробуйте снова.',
        };
    }

    const now = new Date();
    const { data: existing, error: loadError } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('biz_id', bizId)
        .eq('id', params.expectedShiftId)
        .maybeSingle();

    if (loadError) {
        logError('StaffShiftCloseService', 'Error loading shift for close', loadError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message:
                loadError.message ||
                'Не удалось загрузить данные смены. Проверьте подключение к интернету и попробуйте снова.',
        };
    }

    if (!existing) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message:
                'Смена на сегодня ещё не открыта. Сначала откройте смену, затем добавьте клиентов и закройте её.',
        };
    }

    if (!actorId) return financeCommandFailure({ code: '42501' });
    if (existing.id !== params.expectedShiftId) return financeCommandFailure({ code: '40001' });
    if (existing.status === 'closed') return { ok: true, shift: existing };
    if (existing.ledger_revision !== params.expectedRevision) return financeCommandFailure({ code: '40001' });

    // Closing finalizes the saved ledger; it must not recreate client records.
    // Saving/editing positions belongs to the items endpoint while the shift is open.
    const admin = getServiceClient();
    let snapshot;
    try { snapshot = await readShiftCloseSnapshot(admin, bizId, staffId, existing.id); }
    catch (error) {
        logError('StaffShiftCloseService', 'Error loading complete shift ledger', error);
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Не удалось загрузить полный список клиентов смены.' };
    }
    if (snapshot.shift.ledger_revision !== params.expectedRevision || snapshot.shift.status !== 'open') return financeCommandFailure({ code: '40001' });
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
            message:
                'Смена на сегодня ещё не открыта. Сначала откройте смену, затем добавьте клиентов и закройте её.',
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

    const { totalAmount, hoursWorked, financials } = decision;
    if (!isShiftDurationWithinDay(hoursWorked, snapshot.dayHours)) return { ok: false, statusCode: 409, errorType: 'validation', message: 'Часы превышают длину локального дня смены.' };
    const closedAt = financialCloseTime.toISOString();

    const { data: rpcResult, error: rpcError } = await measurePerformance(
        'shift_close',
        async () =>
            commitShiftClose({
                client: admin, shiftId: existing.id, actorId, revision: params.expectedRevision,
                staff: snapshot.staff, financials, hoursWorked, closedAt,
            }),
        { shiftId: existing.id, staffId, totalAmount, itemsCount: items.length },
    );

    if (rpcError) {
        logError('StaffShiftCloseService', 'Atomic close failed', rpcError);
        return financeCommandFailure(rpcError);
    }

    const typedResult = rpcResult as CloseStaffShiftRpcResult | null;
    if (!typedResult || !typedResult.ok) {
        const errorMessage = typedResult?.error || 'Не удалось закрыть смену';
        logError('StaffShiftCloseService', 'RPC returned error', { error: errorMessage, result: rpcResult });
        return { ok: false, statusCode: 500, errorType: 'internal', message: errorMessage };
    }

    const updatedShift = typedResult.shift;
    if (!updatedShift) {
        logError('StaffShiftCloseService', 'RPC returned ok but no shift data', rpcResult);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message:
                'Смена закрыта, но не удалось получить обновленные данные. Обновите страницу для просмотра результатов.',
        };
    }

    if (typedResult.action !== 'already_closed') await queueShiftCloseNotification({
        admin,
        bizId,
        ymd: existing.shift_date,
        staffData,
        financials,
        itemsCount: items.length,
        hoursWorked: hoursWorked ?? 0,
    }).catch((error) => logError('StaffShiftCloseService', 'Notification failed after committed close', error));

    return {
        ok: true,
        shift: updatedShift,
    };
}
