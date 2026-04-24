import { logError } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performance';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';
import { validateRequest } from '@/lib/validation/apiValidation';
import { closeShiftSchema, dateStringSchema } from '@/lib/validation/schemas';

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

type Result =
    | { ok: false; statusCode: number; errorType: 'validation' | 'internal' | 'not_found' | 'forbidden'; message: string }
    | { ok: true; shift: StaffShiftRow };

export async function runDashboardStaffShiftClose({
    req,
    admin,
    bizId,
    staffId,
}: {
    req: Request;
    admin: any;
    bizId: string;
    staffId: string;
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

    const { items = [], totalAmount: totalAmountRaw = 0, consumablesAmount = 0 } = validationResult.data;
    const now = new Date();

    const { data: existing, error: loadError } = await admin
        .from('staff_shifts')
        .select('*')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('shift_date', ymdResult.ymd)
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

    if (existing.status === 'closed') {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Смена уже закрыта. Обновите страницу для просмотра результатов.',
        };
    }

    const closedAt = getTomorrowMidnightIso(now);
    const decision = closeStaffShiftUseCase({
        now,
        staff: {
            percentMaster: staff.percent_master,
            percentSalon: staff.percent_salon,
            hourlyRate: staff.hourly_rate,
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
    const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

    const { data: rpcResult, error: rpcError } = await measurePerformance(
        'shift_close_dashboard',
        async () =>
            admin.rpc('close_staff_shift_safe', {
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
        { shiftId: existing.id, staffId, itemsCount: items.length },
    );

    if (rpcError) {
        logError('DashboardStaffShiftClose', 'Error calling close_staff_shift_safe RPC', rpcError);
        let message = 'Не удалось закрыть смену';
        if (rpcError.code === 'P0001' || rpcError.message?.includes('already closed')) {
            message = 'Смена уже закрыта';
        } else if (rpcError.code === '23505') {
            message = 'Конфликт данных. Обновите страницу.';
        } else if (rpcError.message) {
            message = rpcError.message;
        }

        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message,
        };
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
    const bookingIds = await syncShiftItems({ admin, shiftId: updated.id, items });
    await markShiftBookingsPaid({ admin, bookingIds });
    await markMissingBookingsNoShow({
        admin,
        staffId,
        ymd: ymdResult.ymd,
        includedBookingIds: bookingIds,
    });
    await queueShiftCloseNotification({
        admin,
        bizId,
        ymd: ymdResult.ymd,
        staff,
        financials,
        itemsCount: items.length,
        hoursWorked: hoursWorked ?? 0,
    });

    return {
        ok: true,
        shift: updated as StaffShiftRow,
    };
}

function resolveShiftDate(req: Request):
    | { ok: true; ymd: string }
    | { ok: false; statusCode: 400; errorType: 'validation'; message: string } {
    const dateParam = new URL(req.url).searchParams.get('date');
    if (!dateParam) {
        return { ok: true, ymd: formatDateInTz(new Date(), TZ) };
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
            (item) => item.service_amount > 0 || item.consumables_amount > 0 || item.booking_id !== null,
        );
}

async function syncShiftItems({
    admin,
    shiftId,
    items,
}: {
    admin: any;
    shiftId: string;
    items: ShiftItemInput[];
}) {
    const { data: existingItems } = await admin
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
    for (const bookingId of cleanItems.map((item) => item.booking_id).filter((id): id is string => !!id)) {
        bookingIds.add(bookingId);
    }

    const { error: deleteError } = await admin.from('staff_shift_items').delete().eq('shift_id', shiftId);
    if (deleteError) {
        logError('DashboardStaffShiftClose', 'Error deleting old shift items', deleteError);
        return bookingIds;
    }

    if (cleanItems.length > 0) {
        const { error: insertError } = await admin.from('staff_shift_items').insert(cleanItems);
        if (insertError) {
            logError('DashboardStaffShiftClose', 'Error inserting shift items', insertError);
        }
    }

    return bookingIds;
}

async function markShiftBookingsPaid({
    admin,
    bookingIds,
}: {
    admin: any;
    bookingIds: Set<string>;
}) {
    if (bookingIds.size === 0) {
        return;
    }

    try {
        const bookingIdsArray = Array.from(bookingIds);
        const { data: bookingsForUpdate, error: bookingsForUpdateError } = await admin
            .from('bookings')
            .select('id, status')
            .in('id', bookingIdsArray);

        if (bookingsForUpdateError) {
            logError('DashboardStaffShiftClose', 'Error loading bookings for status update', bookingsForUpdateError);
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

                const { error: rpcErr } = await admin.rpc('update_booking_status_with_promotion', {
                    p_booking_id: bookingId,
                    p_new_status: 'paid',
                });

                if (!rpcErr) {
                    continue;
                }

                if (
                    rpcErr.message?.includes('function') ||
                    rpcErr.message?.includes('does not exist') ||
                    rpcErr.message?.includes('schema cache')
                ) {
                    const { error: fallbackRpcErr } = await admin.rpc('update_booking_status_no_check', {
                        p_booking_id: bookingId,
                        p_new_status: 'paid',
                    });
                    if (
                        fallbackRpcErr &&
                        !fallbackRpcErr.message?.includes('function') &&
                        !fallbackRpcErr.message?.includes('does not exist')
                    ) {
                        await admin.from('bookings').update({ status: 'paid' }).eq('id', bookingId);
                    }
                } else {
                    logError('DashboardStaffShiftClose', `Error updating booking ${bookingId} to paid`, rpcErr);
                }
            } catch (error) {
                logError('DashboardStaffShiftClose', `Error updating booking ${bookingId} status`, error);
            }
        }
    } catch (error) {
        logError('DashboardStaffShiftClose', 'Unexpected error updating bookings to paid', error);
    }
}

async function markMissingBookingsNoShow({
    admin,
    staffId,
    ymd,
    includedBookingIds,
}: {
    admin: any;
    staffId: string;
    ymd: string;
    includedBookingIds: Set<string>;
}) {
    const { data: todayBookings, error: bookingsError } = await admin
        .from('bookings')
        .select('id, status')
        .eq('staff_id', staffId)
        .gte('start_at', `${ymd}T00:00:00`)
        .lte('start_at', `${ymd}T23:59:59`)
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
            const { error: rpcErr } = await admin.rpc('update_booking_status_no_check', {
                p_booking_id: booking.id,
                p_new_status: 'no_show',
            });
            if (rpcErr && !rpcErr.message?.includes('function') && !rpcErr.message?.includes('does not exist')) {
                await admin.from('bookings').update({ status: 'no_show' }).eq('id', booking.id);
            }
        } catch (error) {
            logError('DashboardStaffShiftClose', `Error updating booking ${booking.id} to no_show`, error);
        }
    }
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
    admin: any;
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

