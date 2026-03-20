import { logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { calculateShiftPercentTotals } from './shiftItemsFinance';

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
};

type PromotionApplied = {
    final_amount?: unknown;
};

type BookingWithPromotion = {
    id: string;
    promotion_applied?: PromotionApplied | null;
};

type ExistingShiftItem = {
    id: string | null;
};

type SavedShiftItem = {
    service_amount: number | null;
    consumables_amount: number | null;
};

type BookingStatusRecord = {
    id: string;
    status: string;
    start_at: string | null;
};

type ServiceClientLike = {
    from: (table: string) => {
        select: (columns: string) => any;
        update: (values: Record<string, unknown>) => any;
        insert: (values: unknown) => any;
        delete: () => any;
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
};

type SaveShiftItemsParams = {
    items: ShiftItemInput[];
    percentMaster: number;
    percentSalon: number;
    readClient: ServiceClientLike;
    shiftId: string;
    staffId: string;
    writeClient: ServiceClientLike;
};

type SaveShiftItemsError = {
    message: string;
    statusCode: number;
    type: 'internal' | 'validation';
};

type SaveShiftItemsResult =
    | { ok: true }
    | { ok: false; error: SaveShiftItemsError };

function getBookingIds(items: ShiftItemInput[]) {
    return items
        .map((item) => item.bookingId ?? item.booking_id ?? null)
        .filter((id): id is string => Boolean(id));
}

async function updateBookingsStatus(allBookingIds: string[]) {
    if (!allBookingIds.length) {
        return;
    }

    const admin = getServiceClient();

    try {
        const nowTs = new Date();
        const { data: bookingsForUpdate, error: bookingsError } = await admin
            .from('bookings')
            .select('id, status, start_at')
            .in('id', allBookingIds);

        if (bookingsError) {
            logError('StaffShiftItems', 'Error loading bookings for status update', bookingsError);
            return;
        }

        if (!bookingsForUpdate || bookingsForUpdate.length === 0) {
            return;
        }

        const bookingsMap = new Map<string, BookingStatusRecord>();
        for (const booking of bookingsForUpdate as BookingStatusRecord[]) {
            bookingsMap.set(String(booking.id), {
                id: String(booking.id),
                status: String(booking.status),
                start_at: booking.start_at ?? null,
            });
        }

        for (const bookingId of allBookingIds) {
            const booking = bookingsMap.get(bookingId);
            if (!booking) continue;
            if (booking.status === 'paid' || booking.status === 'no_show') continue;

            if (booking.start_at) {
                const startAt = new Date(booking.start_at);
                if (startAt > nowTs) continue;
            }

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
                        const { error: updateError } = await admin.from('bookings').update({ status: 'paid' }).eq('id', booking.id);
                        if (updateError) {
                            logError('StaffShiftItems', `Error updating booking ${booking.id} status`, updateError);
                        }
                    }
                } else if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                    logError('StaffShiftItems', `Error applying promotion to booking ${booking.id}`, rpcError);
                }
            } catch (error) {
                logError('StaffShiftItems', `Error updating booking ${booking.id} status`, error);
            }
        }
    } catch (error) {
        logError('StaffShiftItems', 'Unexpected error while updating bookings to paid', error);
    }
}

async function loadPromotionMap(readClient: ServiceClientLike, items: ShiftItemInput[]) {
    const bookingIds = getBookingIds(items);
    const promotionMap = new Map<string, number>();

    if (!bookingIds.length) {
        return promotionMap;
    }

    const { data: bookingsWithPromotion } = await readClient
        .from('bookings')
        .select('id, promotion_applied')
        .in('id', bookingIds);

    if (!bookingsWithPromotion) {
        return promotionMap;
    }

    for (const booking of bookingsWithPromotion as BookingWithPromotion[]) {
        if (booking.promotion_applied && typeof booking.promotion_applied === 'object' && 'final_amount' in booking.promotion_applied) {
            const finalAmount = Number(booking.promotion_applied.final_amount);
            if (!Number.isNaN(finalAmount) && finalAmount >= 0) {
                promotionMap.set(String(booking.id), finalAmount);
            }
        }
    }

    return promotionMap;
}

function buildExistingItemIdSet(existingItemsData: ExistingShiftItem[] | null | undefined) {
    const existingItemIds = new Set<string>();

    if (!existingItemsData) {
        return existingItemIds;
    }

    for (const item of existingItemsData) {
        if (item.id) {
            existingItemIds.add(item.id);
        }
    }

    return existingItemIds;
}

async function upsertShiftItems(params: {
    items: ShiftItemInput[];
    promotionMap: Map<string, number>;
    shiftId: string;
    writeClient: ServiceClientLike;
}) {
    const { items, promotionMap, shiftId, writeClient } = params;

    if (items.length === 0) {
        return { ok: true as const };
    }

    const existingItems = items.filter((item) => Boolean(item.id));
    const newItems = items.filter((item) => !item.id);

    if (existingItems.length > 0) {
        for (const item of existingItems) {
            const bookingId = item.bookingId ?? item.booking_id ?? null;
            const serviceAmount = bookingId && promotionMap.has(bookingId)
                ? promotionMap.get(bookingId)!
                : Number(item.serviceAmount ?? item.amount ?? 0) || 0;

            const { error: updateError } = await writeClient
                .from('staff_shift_items')
                .update({
                    client_name: (item.clientName ?? item.client_name ?? '').trim() || null,
                    service_name: (item.serviceName ?? item.service_name ?? '').trim() || null,
                    service_amount: serviceAmount,
                    consumables_amount: Number(item.consumablesAmount ?? item.consumables_amount ?? 0) || 0,
                    booking_id: bookingId,
                })
                .eq('id', item.id);

            if (updateError) {
                logError('StaffShiftItems', `Error updating item ${item.id}`, updateError);
            }
        }
    }

    const cleanItems = newItems
        .map((item, index) => {
            const bookingId = item.bookingId ?? item.booking_id ?? null;
            const serviceAmount = bookingId && promotionMap.has(bookingId)
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
        .filter((item) => {
            return (
                item.service_amount > 0 ||
                item.consumables_amount > 0 ||
                item.booking_id !== null ||
                (item.client_name !== null && item.client_name !== '')
            );
        });

    if (cleanItems.length === 0) {
        return { ok: true as const };
    }

    const { error: insertError } = await writeClient.from('staff_shift_items').insert(cleanItems);
    if (insertError) {
        logError('StaffShiftItems', 'Error inserting items', insertError);
        return {
            ok: false as const,
            error: {
                message: 'Не удалось сохранить позиции',
                statusCode: 500,
                type: 'internal' as const,
            },
        };
    }

    return { ok: true as const };
}

async function deleteRemovedItems(params: {
    existingItemIds: Set<string>;
    items: ShiftItemInput[];
    shiftId: string;
    staffId: string;
    writeClient: ServiceClientLike;
}) {
    const { existingItemIds, items, shiftId, staffId, writeClient } = params;
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
            logError('StaffShiftItems', 'Items to delete but no items with id in request - skipping deletion', {
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
        logError('StaffShiftItems', 'Attempted to delete all items - preventing deletion', {
            staffId,
            shiftId,
            itemsToDeleteCount: itemsToDelete.length,
            totalItemsCount: existingItemIds.size,
        });

        return {
            ok: false as const,
            error: {
                message: 'Попытка удалить все клиенты. Операция заблокирована для безопасности.',
                statusCode: 400,
                type: 'validation' as const,
            },
        };
    }

    const { error: deleteError } = await writeClient.from('staff_shift_items').delete().in('id', itemsToDelete);
    if (deleteError) {
        logError('StaffShiftItems', 'Error deleting removed items', deleteError);
        return {
            ok: false as const,
            error: {
                message: 'Не удалось удалить позиции',
                statusCode: 500,
                type: 'internal' as const,
            },
        };
    }

    return { ok: true as const };
}

async function recalculateShiftTotals(params: {
    percentMaster: number;
    percentSalon: number;
    readClient: ServiceClientLike;
    shiftId: string;
    writeClient: ServiceClientLike;
}) {
    const { percentMaster, percentSalon, readClient, shiftId, writeClient } = params;

    const { data: savedItems } = await readClient
        .from('staff_shift_items')
        .select('service_amount, consumables_amount')
        .eq('shift_id', shiftId);

    let totalAmount = 0;
    let consumablesAmount = 0;

    if (savedItems && savedItems.length > 0) {
        totalAmount = (savedItems as SavedShiftItem[]).reduce((sum, item) => sum + Number(item.service_amount ?? 0), 0);
        consumablesAmount = (savedItems as SavedShiftItem[]).reduce((sum, item) => sum + Number(item.consumables_amount ?? 0), 0);
    }

    const totals = calculateShiftPercentTotals({
        consumablesAmount,
        percentMaster,
        percentSalon,
        totalAmount,
    });

    const { error: updateShiftError } = await writeClient
        .from('staff_shifts')
        .update({
            total_amount: totals.totalAmount,
            consumables_amount: totals.consumablesAmount,
            percent_master: totals.normalizedMaster,
            percent_salon: totals.normalizedSalon,
            master_share: totals.masterShare,
            salon_share: totals.salonShare,
        })
        .eq('id', shiftId);

    if (updateShiftError) {
        logError('StaffShiftItems', 'Error updating shift totals', updateShiftError);
    }
}

export async function saveShiftItemsForShift({
    items,
    percentMaster,
    percentSalon,
    readClient,
    shiftId,
    staffId,
    writeClient,
}: SaveShiftItemsParams): Promise<SaveShiftItemsResult> {
    const { data: existingItemsData } = await writeClient
        .from('staff_shift_items')
        .select('id')
        .eq('shift_id', shiftId);

    const existingItemIds = buildExistingItemIdSet(existingItemsData as ExistingShiftItem[] | null | undefined);

    await updateBookingsStatus(getBookingIds(items));

    const promotionMap = await loadPromotionMap(readClient, items);

    const upsertResult = await upsertShiftItems({
        items,
        promotionMap,
        shiftId,
        writeClient,
    });
    if (!upsertResult.ok) {
        return upsertResult;
    }

    const deleteResult = await deleteRemovedItems({
        existingItemIds,
        items,
        shiftId,
        staffId,
        writeClient,
    });
    if (!deleteResult.ok) {
        return deleteResult;
    }

    await recalculateShiftTotals({
        percentMaster,
        percentSalon,
        readClient,
        shiftId,
        writeClient,
    });

    return { ok: true };
}
