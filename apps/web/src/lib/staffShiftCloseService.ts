import { logError } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performance';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';

type StaffShiftRow = {
    id: string;
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
    shift?: StaffShiftRow | null;
};

type ShiftItemInput = {
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
    | { ok: false; statusCode: number; errorType: 'validation' | 'internal'; message: string }
    | { ok: true; shift: StaffShiftRow };

function getTomorrowMidnightIso(now: Date) {
    const todayInTz = formatDateInTz(now, TZ);
    const todayDate = new Date(`${todayInTz}T12:00:00`);
    todayDate.setDate(todayDate.getDate() + 1);
    const nextDayYmd = formatDateInTz(todayDate, TZ);
    return dateAtTz(nextDayYmd, '00:00').toISOString();
}

function normalizeShiftItems(items: ShiftItemInput[], shiftId: string) {
    return items
        .map((item) => ({
            shift_id: shiftId,
            client_name: item.clientName ?? item.client_name ?? null,
            service_name: item.serviceName ?? item.service_name ?? null,
            service_amount: Number(item.serviceAmount ?? item.amount ?? 0) || 0,
            consumables_amount: Number(item.consumablesAmount ?? item.consumables_amount ?? 0) || 0,
            booking_id: item.bookingId ?? item.booking_id ?? null,
            note: item.note ?? null,
        }))
        .filter(
            (item) =>
                item.service_amount > 0 ||
                item.consumables_amount > 0 ||
                item.booking_id !== null,
        );
}

async function syncShiftItems(params: {
    supabase: any;
    shiftId: string;
    items: ShiftItemInput[];
}) {
    const { supabase, shiftId, items } = params;
    const { data: existingItems } = await supabase
        .from('staff_shift_items')
        .select('booking_id')
        .eq('shift_id', shiftId)
        .not('booking_id', 'is', null);

    const bookingIds = new Set<string>(
        (existingItems ?? [])
            .map((item: { booking_id: string | null }) => item.booking_id)
            .filter((id: string | null): id is string => !!id),
    );

    if (items.length === 0) {
        return bookingIds;
    }

    const cleanItems = normalizeShiftItems(items, shiftId);
    for (const bookingId of cleanItems
        .map((item) => item.booking_id)
        .filter((id): id is string => !!id)) {
        bookingIds.add(bookingId);
    }

    const { error: deleteError } = await supabase
        .from('staff_shift_items')
        .delete()
        .eq('shift_id', shiftId);

    if (deleteError) {
        logError('StaffShiftCloseService', 'Error deleting old shift items', deleteError);
        return bookingIds;
    }

    if (cleanItems.length > 0) {
        const { error: insertError } = await supabase.from('staff_shift_items').insert(cleanItems);
        if (insertError) {
            logError('StaffShiftCloseService', 'Error inserting shift items', insertError);
        }
    }

    return bookingIds;
}

async function markShiftBookingsPaid(params: {
    admin: any;
    bookingIds: Set<string>;
}) {
    const { admin, bookingIds } = params;
    if (bookingIds.size === 0) {
        return;
    }

    try {
        const bookingIdsArray = Array.from(bookingIds);
        const { data: bookingsForUpdate, error: bookingsError } = await admin
            .from('bookings')
            .select('id, status')
            .in('id', bookingIdsArray);

        if (bookingsError) {
            logError('StaffShiftCloseService', 'Error loading bookings for status update', bookingsError);
        }

        const statusMap = new Map<string, string>();
        for (const booking of bookingsForUpdate || []) {
            statusMap.set(String(booking.id), String(booking.status));
        }

        for (const bookingId of bookingIdsArray) {
            try {
                const currentStatus = statusMap.get(bookingId);
                if (currentStatus === 'paid' || currentStatus === 'no_show') {
                    continue;
                }

                const { error: rpcError } = await admin.rpc('update_booking_status_with_promotion', {
                    p_booking_id: bookingId,
                    p_new_status: 'paid',
                });

                if (!rpcError) {
                    continue;
                }

                if (
                    rpcError.message?.includes('function') ||
                    rpcError.message?.includes('does not exist') ||
                    rpcError.message?.includes('schema cache')
                ) {
                    const { error: fallbackRpcError } = await admin.rpc('update_booking_status_no_check', {
                        p_booking_id: bookingId,
                        p_new_status: 'paid',
                    });

                    if (
                        fallbackRpcError &&
                        !fallbackRpcError.message?.includes('function') &&
                        !fallbackRpcError.message?.includes('does not exist')
                    ) {
                        await admin.from('bookings').update({ status: 'paid' }).eq('id', bookingId);
                    }
                } else {
                    logError(
                        'StaffShiftCloseService',
                        `Error updating booking ${bookingId} status to paid via promotions RPC`,
                        rpcError,
                    );
                }
            } catch (error) {
                logError('StaffShiftCloseService', `Error updating booking ${bookingId} status`, error);
            }
        }
    } catch (error) {
        logError('StaffShiftCloseService', 'Unexpected error while updating bookings to paid', error);
    }
}

async function markMissingBookingsNoShow(params: {
    admin: any;
    staffId: string;
    ymd: string;
    includedBookingIds: Set<string>;
}) {
    const { admin, staffId, ymd, includedBookingIds } = params;
    const todayStart = `${ymd}T00:00:00`;
    const todayEnd = `${ymd}T23:59:59`;

    const { data: todayBookings, error: bookingsError } = await admin
        .from('bookings')
        .select('id, status')
        .eq('staff_id', staffId)
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd)
        .neq('status', 'cancelled');

    if (bookingsError || !todayBookings) {
        return;
    }

    const notAddedBookings = todayBookings.filter(
        (booking: { id: string; status: string }) =>
            !includedBookingIds.has(booking.id) &&
            booking.status !== 'no_show' &&
            booking.status !== 'paid' &&
            booking.status !== 'confirmed',
    );

    for (const booking of notAddedBookings) {
        try {
            const { error: rpcError } = await admin.rpc('update_booking_status_no_check', {
                p_booking_id: booking.id,
                p_new_status: 'no_show',
            });

            if (
                rpcError &&
                !rpcError.message?.includes('function') &&
                !rpcError.message?.includes('does not exist')
            ) {
                await admin.from('bookings').update({ status: 'no_show' }).eq('id', booking.id);
            }
        } catch (error) {
            logError(
                'StaffShiftCloseService',
                `Error updating booking ${booking.id} status to no_show`,
                error,
            );
        }
    }
}

async function queueShiftCloseNotification(params: {
    admin: any;
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
    supabase: any;
    staffId: string;
    bizId: string;
    items?: ShiftItemInput[];
    totalAmountRaw?: number;
    consumablesAmount?: number;
}): Promise<ServiceResult> {
    const {
        supabase,
        staffId,
        bizId,
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
    const ymd = formatDateInTz(now, TZ);
    const { data: existing, error: loadError } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
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

    if (existing.status === 'closed') {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Смена уже закрыта. Обновите страницу для просмотра результатов.',
        };
    }

    const decision = closeStaffShiftUseCase({
        now,
        staff: {
            percentMaster: staffData?.percent_master,
            percentSalon: staffData?.percent_salon,
            hourlyRate: staffData?.hourly_rate,
        },
        shift: existing,
        items,
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
    const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;
    const closedAt = getTomorrowMidnightIso(now);

    const { data: rpcResult, error: rpcError } = await measurePerformance(
        'shift_close',
        async () =>
            supabase.rpc('close_staff_shift_safe', {
                p_shift_id: existing.id,
                p_total_amount: financials.totalAmount,
                p_consumables_amount: financials.totalConsumables,
                p_percent_master: financials.normalizedPercentMaster,
                p_percent_salon: financials.normalizedPercentSalon,
                p_master_share: financials.finalMasterShare,
                p_salon_share: financials.finalSalonShare,
                p_hours_worked: hoursWorked,
                p_hourly_rate: hourlyRate,
                p_guaranteed_amount: financials.guaranteedAmount,
                p_topup_amount: financials.topupAmount,
                p_closed_at: closedAt,
            }),
        { shiftId: existing.id, staffId, totalAmount, itemsCount: items.length },
    );

    if (rpcError) {
        logError('StaffShiftCloseService', 'Error calling close_staff_shift_safe RPC', rpcError);
        if (rpcError.code === 'P0001' || rpcError.message?.includes('already closed')) {
            return { ok: false, statusCode: 500, errorType: 'internal', message: 'Смена уже закрыта' };
        }
        if (rpcError.code === '23505') {
            return {
                ok: false,
                statusCode: 500,
                errorType: 'internal',
                message:
                    'Конфликт данных. Смена могла быть закрыта другим процессом. Обновите страницу.',
            };
        }
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: rpcError.message || 'Не удалось закрыть смену',
        };
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

    const admin = getServiceClient();
    const bookingIds = await syncShiftItems({
        supabase,
        shiftId: updatedShift.id,
        items,
    });

    await markShiftBookingsPaid({ admin, bookingIds });
    await markMissingBookingsNoShow({
        admin,
        staffId,
        ymd,
        includedBookingIds: bookingIds,
    });
    await queueShiftCloseNotification({
        admin,
        bizId,
        ymd,
        staffData,
        financials,
        itemsCount: items.length,
        hoursWorked: hoursWorked ?? 0,
    });

    return {
        ok: true,
        shift: updatedShift,
    };
}
