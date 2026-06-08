import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError } from '@/lib/log';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';

type SupabaseClientLike = {
    from: SupabaseClient['from'];
    rpc: SupabaseClient['rpc'];
};

type ShiftRow = {
    id: string;
    staff_id: string;
    shift_date: string;
    opened_at: string | null;
    branch_id: string | null;
    biz_id: string | null;
};

type StaffSettingsRow = {
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

type ShiftItemAmountRow = {
    service_amount: number | null;
    consumables_amount: number | null;
};

type ShiftItemBookingRow = {
    booking_id: string | null;
};

type BookingStatusRow = {
    id: string;
    status: string;
};

type ServicePricingRow = {
    price_from?: number | null;
    price_to?: number | null;
};

type BookingPricingRow = {
    id: string;
    service_id: string | null;
    services: ServicePricingRow[] | ServicePricingRow | null;
};

type CloseStaffShiftRpcResult = {
    ok: boolean;
    error?: string | null;
    action?: string | null;
};

type CloseShiftFinancials = {
    totalAmount: number;
    finalConsumablesAmount: number;
    normalizedMaster: number;
    normalizedSalon: number;
    finalMasterShare: number;
    finalSalonShare: number;
    hoursWorked: number | null;
    hourlyRate: number | null;
    guaranteedAmount: number;
    topupAmount: number;
    closedAt: string;
};

type CloseShiftsCronSuccess = {
    ok: true;
    data: {
        ok: true;
        message: string;
        closed: number;
        total: number;
        errors?: string[];
    };
};

type CloseShiftsCronFailure = {
    ok: false;
    status: 500;
    error: 'internal';
    message: string;
};

type CloseShiftsCronResult = CloseShiftsCronSuccess | CloseShiftsCronFailure;

export async function runCloseShiftsCron({
    supabase,
    now = new Date(),
}: {
    supabase: SupabaseClientLike;
    now?: Date;
}): Promise<CloseShiftsCronResult> {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = formatDateInTz(yesterday, TZ);

    logDebug('CloseShiftsCron', 'Closing shifts for date', { ymd });

    const { data: openShifts, error: findError } = await supabase
        .from('staff_shifts')
        .select('id, staff_id, shift_date, opened_at, branch_id, biz_id')
        .eq('status', 'open')
        .eq('shift_date', ymd);

    if (findError) {
        logError('CloseShiftsCron', 'Error finding open shifts', findError);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: findError.message || 'Failed to find open shifts',
        };
    }

    if (!openShifts || openShifts.length === 0) {
        logDebug('CloseShiftsCron', 'No open shifts to close');
        return {
            ok: true,
            data: {
                message: 'No open shifts to close',
                closed: 0,
                ok: true,
                total: 0,
            },
        };
    }

    logDebug('CloseShiftsCron', 'Found open shifts to close', { count: openShifts.length });

    let closedCount = 0;
    const errors: string[] = [];

    for (const shift of openShifts as ShiftRow[]) {
        const shiftResult = await closeSingleShift({ supabase, shift, ymd, now });

        if (shiftResult.ok) {
            closedCount += 1;
            continue;
        }

        errors.push(shiftResult.error);
    }

    if (errors.length > 0) {
        logError('CloseShiftsCron', 'Completed with errors', {
            closedCount,
            total: openShifts.length,
            errors,
        });
    } else {
        logDebug('CloseShiftsCron', 'Completed successfully', {
            closedCount,
            total: openShifts.length,
        });
    }

    return {
        ok: true,
        data: {
            ok: true,
            message: `Closed ${closedCount} of ${openShifts.length} shifts`,
            closed: closedCount,
            total: openShifts.length,
            errors: errors.length > 0 ? errors : undefined,
        },
    };
}

async function closeSingleShift({
    supabase,
    shift,
    ymd,
    now,
}: {
    supabase: SupabaseClientLike;
    shift: ShiftRow;
    ymd: string;
    now: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate')
            .eq('id', shift.staff_id)
            .maybeSingle();

        if (staffError || !staffData) {
            logError('CloseShiftsCron', `Error loading staff ${shift.staff_id}`, staffError);
            return {
                ok: false,
                error: `Staff ${shift.staff_id}: ${staffError?.message || 'Not found'}`,
            };
        }

        const financials = await calculateShiftFinancials({
            supabase,
            shift,
            ymd,
            now,
            staffData: staffData as StaffSettingsRow,
        });

        const { data: rpcResult, error: rpcError } = await supabase.rpc('close_staff_shift_safe', {
            p_shift_id: shift.id,
            p_total_amount: financials.totalAmount,
            p_consumables_amount: financials.finalConsumablesAmount,
            p_percent_master: financials.normalizedMaster,
            p_percent_salon: financials.normalizedSalon,
            p_master_share: financials.finalMasterShare,
            p_salon_share: financials.finalSalonShare,
            p_hours_worked: financials.hoursWorked,
            p_hourly_rate: financials.hourlyRate,
            p_guaranteed_amount: financials.guaranteedAmount,
            p_topup_amount: financials.topupAmount,
            p_closed_at: financials.closedAt,
        });

        if (rpcError) {
            logError('CloseShiftsCron', `Error calling close_staff_shift_safe for shift ${shift.id}`, rpcError);
            return {
                ok: false,
                error: `Shift ${shift.id}: ${rpcError.message}`,
            };
        }

        const typedResult = rpcResult as CloseStaffShiftRpcResult | null;
        if (!typedResult || !typedResult.ok) {
            if (typedResult?.action === 'already_closed') {
                logDebug('CloseShiftsCron', `Shift ${shift.id} already closed by another process`);
                return { ok: true };
            }

            const errorMessage = typedResult?.error || 'Не удалось закрыть смену';
            logError('CloseShiftsCron', `RPC returned error for shift ${shift.id}`, {
                error: errorMessage,
                result: rpcResult,
            });
            return {
                ok: false,
                error: `Shift ${shift.id}: ${errorMessage}`,
            };
        }

        logDebug('CloseShiftsCron', 'Successfully closed shift', { shiftId: shift.id });

        await syncBookingsAfterClose({ supabase, shift, ymd });

        return { ok: true };
    } catch (error) {
        logError('CloseShiftsCron', `Unexpected error closing shift ${shift.id}`, error);
        return {
            ok: false,
            error: `Shift ${shift.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

async function calculateShiftFinancials({
    supabase,
    shift,
    ymd,
    now,
    staffData,
}: {
    supabase: SupabaseClientLike;
    shift: ShiftRow;
    ymd: string;
    now: Date;
    staffData: StaffSettingsRow;
}): Promise<CloseShiftFinancials> {
    const percentMaster = Number(staffData.percent_master ?? 60);
    const percentSalon = Number(staffData.percent_salon ?? 40);
    const hourlyRate = staffData.hourly_rate ? Number(staffData.hourly_rate) : null;

    const { data: shiftItems, error: itemsError } = await supabase
        .from('staff_shift_items')
        .select('service_amount, consumables_amount')
        .eq('shift_id', shift.id);

    if (itemsError) {
        logError('CloseShiftsCron', `Error loading shift items for ${shift.id}`, itemsError);
    }

    let totalAmount = 0;
    let finalConsumablesAmount = 0;

    if (shiftItems && shiftItems.length > 0) {
        totalAmount = (shiftItems as ShiftItemAmountRow[]).reduce(
            (sum, item) => sum + Number(item.service_amount ?? 0),
            0
        );
        finalConsumablesAmount = (shiftItems as ShiftItemAmountRow[]).reduce(
            (sum, item) => sum + Number(item.consumables_amount ?? 0),
            0
        );
    } else {
        const estimatedTotals = await estimateShiftTotalsFromBookings({
            supabase,
            staffId: shift.staff_id,
            ymd,
        });
        totalAmount = estimatedTotals.totalAmount;
    }

    const safePercentMaster = Number.isFinite(percentMaster) ? percentMaster : 60;
    const safePercentSalon = Number.isFinite(percentSalon) ? percentSalon : 40;
    const percentSum = safePercentMaster + safePercentSalon || 100;
    const normalizedMaster = (safePercentMaster / percentSum) * 100;
    const normalizedSalon = 100 - normalizedMaster;

    const masterShare = Math.round((totalAmount * normalizedMaster) / 100);
    const salonShareFromAmount = totalAmount - masterShare;
    const salonShare = salonShareFromAmount + finalConsumablesAmount;

    let hoursWorked: number | null = null;
    let guaranteedAmount = 0;
    let topupAmount = 0;

    if (hourlyRate && shift.opened_at) {
        const openedAt = new Date(shift.opened_at);
        const midnightNextDay = buildMidnightNextDay(now);
        const diffMs = midnightNextDay.getTime() - openedAt.getTime();

        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

        if (guaranteedAmount > masterShare) {
            topupAmount = Math.round((guaranteedAmount - masterShare) * 100) / 100;
        }
    }

    const finalMasterShare = guaranteedAmount > masterShare ? guaranteedAmount : masterShare;
    const finalSalonShare = Math.max(0, salonShare - topupAmount);
    const closedAt = buildMidnightNextDay(now).toISOString();

    return {
        totalAmount,
        finalConsumablesAmount,
        normalizedMaster,
        normalizedSalon,
        finalMasterShare,
        finalSalonShare,
        hoursWorked,
        hourlyRate,
        guaranteedAmount,
        topupAmount,
        closedAt,
    };
}

async function estimateShiftTotalsFromBookings({
    supabase,
    staffId,
    ymd,
}: {
    supabase: SupabaseClientLike;
    staffId: string;
    ymd: string;
}): Promise<{ totalAmount: number }> {
    const dayStart = `${ymd}T00:00:00`;
    const dayEnd = `${ymd}T23:59:59`;

    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, service_id, services:services!bookings_service_id_fkey (price_from, price_to)')
        .eq('staff_id', staffId)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd)
        .neq('status', 'cancelled');

    if (bookingsError || !bookings) {
        return { totalAmount: 0 };
    }

    let totalAmount = 0;

    for (const booking of bookings as BookingPricingRow[]) {
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
        if (!service || typeof service !== 'object') {
            continue;
        }

        const priceFrom = Number(service.price_from ?? 0);
        const priceTo = Number(service.price_to ?? 0);
        if (priceFrom <= 0) {
            continue;
        }

        totalAmount += priceTo > priceFrom ? (priceFrom + priceTo) / 2 : priceFrom;
    }

    return { totalAmount };
}

async function syncBookingsAfterClose({
    supabase,
    shift,
    ymd,
}: {
    supabase: SupabaseClientLike;
    shift: ShiftRow;
    ymd: string;
}) {
    try {
        const dayStart = `${ymd}T00:00:00`;
        const dayEnd = `${ymd}T23:59:59`;

        const { data: todayBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, status')
            .eq('staff_id', shift.staff_id)
            .gte('start_at', dayStart)
            .lte('start_at', dayEnd)
            .neq('status', 'cancelled');

        if (bookingsError || !todayBookings) {
            return;
        }

        const { data: shiftItems } = await supabase
            .from('staff_shift_items')
            .select('booking_id')
            .eq('shift_id', shift.id)
            .not('booking_id', 'is', null);

        const addedBookingIds = new Set(
            ((shiftItems ?? []) as ShiftItemBookingRow[])
                .map(item => item.booking_id)
                .filter((bookingId): bookingId is string => !!bookingId)
        );

        const bookingsById = new Map<string, BookingStatusRow>();
        for (const booking of todayBookings as BookingStatusRow[]) {
            bookingsById.set(String(booking.id), {
                id: String(booking.id),
                status: String(booking.status),
            });
        }

        for (const bookingId of addedBookingIds) {
            const booking = bookingsById.get(bookingId);
            if (!booking || booking.status === 'paid' || booking.status === 'no_show') {
                continue;
            }

            await markBookingAsPaid({ supabase, bookingId: booking.id });
        }

        const notAddedBookings = (todayBookings as BookingStatusRow[]).filter(
            booking =>
                !addedBookingIds.has(String(booking.id)) &&
                booking.status !== 'no_show' &&
                booking.status !== 'paid'
        );

        for (const booking of notAddedBookings) {
            await markBookingAsNoShow({ supabase, bookingId: booking.id });
        }
    } catch (error) {
        logError('CloseShiftsCron', `Unexpected error processing bookings for shift ${shift.id}`, error);
    }
}

async function markBookingAsPaid({
    supabase,
    bookingId,
}: {
    supabase: SupabaseClientLike;
    bookingId: string;
}) {
    try {
        const { error: rpcError } = await supabase.rpc('update_booking_status_with_promotion', {
            p_booking_id: bookingId,
            p_new_status: 'paid',
        });

        if (!rpcError) {
            return;
        }

        if (
            rpcError.message?.includes('function') ||
            rpcError.message?.includes('does not exist') ||
            rpcError.message?.includes('schema cache')
        ) {
            const { error: fallbackRpcError } = await supabase.rpc('update_booking_status_no_check', {
                p_booking_id: bookingId,
                p_new_status: 'paid',
            });

            if (
                fallbackRpcError &&
                !fallbackRpcError.message?.includes('function') &&
                !fallbackRpcError.message?.includes('does not exist')
            ) {
                await supabase.from('bookings').update({ status: 'paid' }).eq('id', bookingId);
            }

            return;
        }

        logError(
            'CloseShiftsCron',
            `Error updating booking ${bookingId} status to paid via promotions RPC`,
            rpcError
        );
    } catch (error) {
        logError('CloseShiftsCron', `Unexpected error updating booking ${bookingId} status to paid`, error);
    }
}

async function markBookingAsNoShow({
    supabase,
    bookingId,
}: {
    supabase: SupabaseClientLike;
    bookingId: string;
}) {
    try {
        const { error: rpcError } = await supabase.rpc('update_booking_status_no_check', {
            p_booking_id: bookingId,
            p_new_status: 'no_show',
        });

        if (
            rpcError &&
            !rpcError.message?.includes('function') &&
            !rpcError.message?.includes('does not exist')
        ) {
            await supabase.from('bookings').update({ status: 'no_show' }).eq('id', bookingId);
        }
    } catch (error) {
        logError('CloseShiftsCron', `Unexpected error updating booking ${bookingId} status to no_show`, error);
    }
}

function buildMidnightNextDay(now: Date) {
    const todayInTz = formatDateInTz(now, TZ);
    const todayDate = new Date(`${todayInTz}T12:00:00`);
    todayDate.setDate(todayDate.getDate() + 1);
    const nextDayYmd = formatDateInTz(todayDate, TZ);

    return dateAtTz(nextDayYmd, '00:00');
}
