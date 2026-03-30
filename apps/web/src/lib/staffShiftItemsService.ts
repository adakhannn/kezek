import { calculateBaseShares, normalizePercentages } from '@/lib/financeDomain';
import { logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ, formatDateInTz } from '@/lib/time';

type SaveShiftItemsResult =
    | { ok: true }
    | { ok: false; statusCode: number; errorType: 'validation' | 'internal' | 'not_found'; message: string };

type SaveShiftItemsParams = {
    supabase: any;
    staffId: string;
    bizId: string;
    items: any[];
    targetShiftDate?: string;
    isOwnerMode: boolean;
    useServiceClient: boolean;
};

function getWriteClient(supabase: any, useServiceClient: boolean) {
    if (!useServiceClient) {
        return supabase;
    }

    try {
        return getServiceClient();
    } catch {
        return supabase;
    }
}

async function resolveShiftId(params: {
    supabase: any;
    writeClient: any;
    staffId: string;
    ymd: string;
    targetShiftDate?: string;
    isOwnerMode: boolean;
}) {
    const { supabase, writeClient, staffId, ymd, targetShiftDate, isOwnerMode } = params;

    const { data: existing, error: findError } = await supabase
        .from('staff_shifts')
        .select('id, status, shift_date')
        .eq('staff_id', staffId)
        .eq('status', 'open')
        .eq('shift_date', ymd)
        .maybeSingle();

    if (findError) {
        logError('StaffShiftItemsService', 'Error finding open shift', {
            error: findError,
            staffId,
            ymd,
            targetShiftDate,
        });
        return {
            ok: false as const,
            statusCode: 500,
            errorType: 'not_found' as const,
            message: 'Не удалось найти открытую смену',
        };
    }

    if (existing) {
        return { ok: true as const, shiftId: existing.id };
    }

    const { data: anyShift } = await supabase
        .from('staff_shifts')
        .select('id, status, shift_date')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (anyShift) {
        logError('StaffShiftItemsService', 'Shift exists but is not open', {
            staffId,
            ymd,
            shiftStatus: anyShift.status,
            targetShiftDate,
        });
        return {
            ok: false as const,
            statusCode: 400,
            errorType: 'validation' as const,
            message: `Смена за ${ymd} закрыта. Откройте смену для редактирования.`,
        };
    }

    if (!isOwnerMode) {
        logError('StaffShiftItemsService', 'No shift found for date', { staffId, ymd, targetShiftDate });
        return {
            ok: false as const,
            statusCode: 400,
            errorType: 'validation' as const,
            message: 'Нет открытой смены. Сначала откройте смену.',
        };
    }

    const now = new Date().toISOString();
    const { data: staffForShift, error: staffForShiftError } = await supabase
        .from('staff')
        .select('biz_id, branch_id')
        .eq('id', staffId)
        .maybeSingle();

    if (staffForShiftError || !staffForShift) {
        logError('StaffShiftItemsService', 'Error loading staff for shift creation', {
            error: staffForShiftError,
            staffId,
        });
        return {
            ok: false as const,
            statusCode: 500,
            errorType: 'internal' as const,
            message: 'Не удалось загрузить данные сотрудника',
        };
    }

    const { data: newShift, error: createError } = await writeClient
        .from('staff_shifts')
        .insert({
            staff_id: staffId,
            biz_id: staffForShift.biz_id,
            branch_id: staffForShift.branch_id,
            shift_date: ymd,
            status: 'open',
            opened_at: now,
        })
        .select('id')
        .single();

    if (createError || !newShift) {
        logError('StaffShiftItemsService', 'Error creating shift for owner', {
            error: createError,
            staffId,
            ymd,
            targetShiftDate,
            bizId: staffForShift.biz_id,
            branchId: staffForShift.branch_id,
        });
        return {
            ok: false as const,
            statusCode: 500,
            errorType: 'internal' as const,
            message: 'Не удалось создать смену',
        };
    }

    return { ok: true as const, shiftId: newShift.id };
}

async function updateBookingStatusesToPaid(params: {
    admin: any;
    bookingIds: string[];
}) {
    const { admin, bookingIds } = params;
    if (bookingIds.length === 0) {
        return;
    }

    try {
        const nowTs = new Date();
        const { data: bookingsForUpdate, error: bookingsError } = await admin
            .from('bookings')
            .select('id, status, start_at')
            .in('id', bookingIds);

        if (bookingsError) {
            logError('StaffShiftItemsService', 'Error loading bookings for status update', bookingsError);
            return;
        }

        const bookingsMap = new Map<string, { id: string; status: string; start_at: string | null }>();
        for (const booking of bookingsForUpdate || []) {
            bookingsMap.set(String(booking.id), {
                id: String(booking.id),
                status: String(booking.status),
                start_at: booking.start_at ?? null,
            });
        }

        await Promise.allSettled(
            bookingIds.map(async (bookingId) => {
                const booking = bookingsMap.get(bookingId);
                if (!booking) return;
                if (booking.status === 'paid' || booking.status === 'no_show') return;
                if (booking.start_at && new Date(booking.start_at) > nowTs) return;

                try {
                    const { error: rpcError } = await admin.rpc('update_booking_status_with_promotion', {
                        p_booking_id: booking.id,
                        p_new_status: 'paid',
                    });

                    if (
                        rpcError &&
                        (rpcError.message?.includes('function') ||
                            rpcError.message?.includes('does not exist') ||
                            rpcError.message?.includes('schema cache'))
                    ) {
                        const { error: fallbackError } = await admin.rpc('update_booking_status_no_check', {
                            p_booking_id: booking.id,
                            p_new_status: 'paid',
                        });

                        if (
                            fallbackError &&
                            !fallbackError.message?.includes('function') &&
                            !fallbackError.message?.includes('does not exist')
                        ) {
                            const { error: updateError } = await admin
                                .from('bookings')
                                .update({ status: 'paid' })
                                .eq('id', booking.id);
                            if (updateError) {
                                logError('StaffShiftItemsService', `Error updating booking ${booking.id} status`, updateError);
                            }
                        }
                    } else if (
                        rpcError &&
                        !rpcError.message?.includes('function') &&
                        !rpcError.message?.includes('does not exist')
                    ) {
                        logError('StaffShiftItemsService', `Error applying promotion to booking ${booking.id}`, rpcError);
                    }
                } catch (error) {
                    logError('StaffShiftItemsService', `Error updating booking ${booking.id} status`, error);
                }
            }),
        );
    } catch (error) {
        logError('StaffShiftItemsService', 'Unexpected error while updating bookings to paid', error);
    }
}

async function buildPromotionMap(supabase: any, items: any[]) {
    const bookingIds = items
        .map((item) => item.bookingId ?? item.booking_id ?? null)
        .filter((id: string | null): id is string => !!id);

    const promotionMap = new Map<string, number>();
    if (bookingIds.length === 0) {
        return promotionMap;
    }

    const { data: bookingsWithPromotion } = await supabase
        .from('bookings')
        .select('id, promotion_applied')
        .in('id', bookingIds);

    if (!bookingsWithPromotion) {
        return promotionMap;
    }

    for (const booking of bookingsWithPromotion) {
        if (
            booking.promotion_applied &&
            typeof booking.promotion_applied === 'object' &&
            'final_amount' in booking.promotion_applied
        ) {
            const finalAmount = Number(booking.promotion_applied.final_amount);
            if (!Number.isNaN(finalAmount) && finalAmount >= 0) {
                promotionMap.set(booking.id, finalAmount);
            }
        }
    }

    return promotionMap;
}

async function upsertShiftItems(params: {
    writeClient: any;
    shiftId: string;
    items: any[];
    promotionMap: Map<string, number>;
}) {
    const { writeClient, shiftId, items, promotionMap } = params;

    const existingItems = items.filter((item) => !!item.id);
    const newItems = items.filter((item) => !item.id);

    if (existingItems.length > 0) {
        await Promise.allSettled(
            existingItems.map(async (item) => {
                const bookingId = item.bookingId ?? item.booking_id ?? null;
                const serviceAmount =
                    bookingId && promotionMap.has(bookingId)
                        ? promotionMap.get(bookingId)!
                        : Number(item.serviceAmount ?? item.amount ?? 0) || 0;

                const { error } = await writeClient
                    .from('staff_shift_items')
                    .update({
                        client_name: (item.clientName ?? item.client_name ?? '').trim() || null,
                        service_name: (item.serviceName ?? item.service_name ?? '').trim() || null,
                        service_amount: serviceAmount,
                        consumables_amount: Number(item.consumablesAmount ?? item.consumables_amount ?? 0) || 0,
                        booking_id: bookingId,
                    })
                    .eq('id', item.id);

                if (error) {
                    logError('StaffShiftItemsService', `Error updating item ${item.id}`, error);
                }
            }),
        );
    }

    const cleanItems = newItems
        .map((item, index) => {
            const bookingId = item.bookingId ?? item.booking_id ?? null;
            const serviceAmount =
                bookingId && promotionMap.has(bookingId)
                    ? promotionMap.get(bookingId)!
                    : Number(item.serviceAmount ?? item.amount ?? 0) || 0;

            return {
                shift_id: shiftId,
                client_name: (item.clientName ?? item.client_name ?? '').trim() || null,
                service_name: (item.serviceName ?? item.service_name ?? '').trim() || null,
                service_amount: serviceAmount,
                consumables_amount: Number(item.consumablesAmount ?? item.consumables_amount ?? 0) || 0,
                booking_id: bookingId,
                created_at: new Date(Date.now() + index * 100).toISOString(),
            };
        })
        .filter(
            (item) =>
                item.service_amount > 0 ||
                item.consumables_amount > 0 ||
                item.booking_id !== null ||
                (item.client_name !== null && item.client_name !== ''),
        );

    if (cleanItems.length === 0) {
        return { ok: true as const };
    }

    const { error } = await writeClient.from('staff_shift_items').insert(cleanItems);
    if (error) {
        logError('StaffShiftItemsService', 'Error inserting items', error);
        return {
            ok: false as const,
            statusCode: 500,
            errorType: 'internal' as const,
            message: 'Не удалось сохранить позиции',
        };
    }

    return { ok: true as const };
}

async function deleteRemovedItems(params: {
    writeClient: any;
    existingItemIds: Set<string>;
    items: any[];
    shiftId: string;
    staffId: string;
}) {
    const { writeClient, existingItemIds, items, shiftId, staffId } = params;

    const newItemIds = new Set<string>();
    for (const item of items) {
        if (item.id) {
            newItemIds.add(item.id);
        }
    }

    const itemsToDelete: string[] = [];
    for (const existingId of existingItemIds) {
        if (!newItemIds.has(existingId)) {
            itemsToDelete.push(existingId);
        }
    }

    const hasItemsWithId = newItemIds.size > 0;
    const shouldDelete = itemsToDelete.length > 0 && (hasItemsWithId || items.length === 0);

    if (!shouldDelete) {
        if (itemsToDelete.length > 0 && !hasItemsWithId && items.length > 0) {
            logError('StaffShiftItemsService', 'Items to delete but no items with id in request - skipping deletion', {
                staffId,
                shiftId,
                itemsToDeleteCount: itemsToDelete.length,
                itemsCount: items.length,
                existingItemIdsCount: existingItemIds.size,
            });
        }
        return { ok: true as const };
    }

    if (itemsToDelete.length === existingItemIds.size && existingItemIds.size > 10) {
        logError('StaffShiftItemsService', 'Attempted to delete all items - preventing deletion', {
            staffId,
            shiftId,
            itemsToDeleteCount: itemsToDelete.length,
            totalItemsCount: existingItemIds.size,
        });
        return {
            ok: false as const,
            statusCode: 400,
            errorType: 'validation' as const,
            message: 'Попытка удалить все клиенты. Операция заблокирована для безопасности.',
        };
    }

    const { error } = await writeClient.from('staff_shift_items').delete().in('id', itemsToDelete);
    if (error) {
        logError('StaffShiftItemsService', 'Error deleting removed items', error);
        return {
            ok: false as const,
            statusCode: 500,
            errorType: 'internal' as const,
            message: 'Не удалось удалить позиции',
        };
    }

    return { ok: true as const };
}

async function recalculateShiftTotals(params: {
    supabase: any;
    writeClient: any;
    shiftId: string;
    percentMaster: number;
    percentSalon: number;
}) {
    const { supabase, writeClient, shiftId, percentMaster, percentSalon } = params;
    const { data: savedItems } = await supabase
        .from('staff_shift_items')
        .select('service_amount, consumables_amount')
        .eq('shift_id', shiftId);

    let totalAmount = 0;
    let finalConsumablesAmount = 0;

    if (savedItems && savedItems.length > 0) {
        totalAmount = savedItems.reduce((sum: number, item: any) => sum + Number(item.service_amount ?? 0), 0);
        finalConsumablesAmount = savedItems.reduce(
            (sum: number, item: any) => sum + Number(item.consumables_amount ?? 0),
            0,
        );
    }

    const normalized = normalizePercentages(percentMaster, percentSalon);
    const { masterShare, salonShare } = calculateBaseShares(
        totalAmount,
        finalConsumablesAmount,
        percentMaster,
        percentSalon,
    );

    const { error } = await writeClient
        .from('staff_shifts')
        .update({
            total_amount: totalAmount,
            consumables_amount: finalConsumablesAmount,
            percent_master: normalized.master,
            percent_salon: normalized.salon,
            master_share: masterShare,
            salon_share: salonShare,
        })
        .eq('id', shiftId);

    if (error) {
        logError('StaffShiftItemsService', 'Error updating shift totals', error);
    }
}

export async function runSaveStaffShiftItems(params: SaveShiftItemsParams): Promise<SaveShiftItemsResult> {
    const { supabase, staffId, items, targetShiftDate, isOwnerMode, useServiceClient } = params;
    const ymd = targetShiftDate ?? formatDateInTz(new Date(), TZ);

    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('percent_master, percent_salon')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffShiftItemsService', 'Error loading staff for percent', staffError);
    }

    const percentMaster = Number(staffData?.percent_master ?? 60);
    const percentSalon = Number(staffData?.percent_salon ?? 40);
    const writeClient = getWriteClient(supabase, useServiceClient);
    const shiftResolution = await resolveShiftId({
        supabase,
        writeClient,
        staffId,
        ymd,
        targetShiftDate,
        isOwnerMode,
    });

    if (!shiftResolution.ok) {
        return shiftResolution;
    }

    const shiftId = shiftResolution.shiftId;
    const { data: existingItemsData } = await writeClient
        .from('staff_shift_items')
        .select('id')
        .eq('shift_id', shiftId);

    const existingItemIds = new Set<string>();
    if (existingItemsData) {
        for (const item of existingItemsData) {
            if (item.id) {
                existingItemIds.add(item.id);
            }
        }
    }

    const allBookingIds = items
        .map((item) => item.bookingId ?? item.booking_id ?? null)
        .filter((id: string | null): id is string => !!id);

    let admin = supabase;
    try {
        admin = getServiceClient();
    } catch {
        admin = supabase;
    }

    await updateBookingStatusesToPaid({ admin, bookingIds: allBookingIds });
    const promotionMap = await buildPromotionMap(supabase, items);

    if (items.length > 0) {
        const upsertResult = await upsertShiftItems({
            writeClient,
            shiftId,
            items,
            promotionMap,
        });
        if (!upsertResult.ok) {
            return upsertResult;
        }
    }

    const deleteResult = await deleteRemovedItems({
        writeClient,
        existingItemIds,
        items,
        shiftId,
        staffId,
    });
    if (!deleteResult.ok) {
        return deleteResult;
    }

    await recalculateShiftTotals({
        supabase,
        writeClient,
        shiftId,
        percentMaster,
        percentSalon,
    });

    return { ok: true };
}
