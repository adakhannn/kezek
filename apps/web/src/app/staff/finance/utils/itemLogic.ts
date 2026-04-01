import type { ShiftItem } from '../types';

export function serializeShiftItems(items: ShiftItem[]): string {
    return JSON.stringify(
        items.map((it) => ({
            id: it.id ?? null,
            clientName: it.clientName ?? '',
            serviceName: it.serviceName ?? '',
            serviceAmount: it.serviceAmount ?? 0,
            consumablesAmount: it.consumablesAmount ?? 0,
            bookingId: it.bookingId ?? null,
            createdAt: it.createdAt ?? null,
        })),
    );
}

export function isAutoClientName(name: string | null | undefined, clientLabel: string): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;

    return trimmed.startsWith(`${clientLabel} `) && /\d+$/.test(trimmed);
}

export function hasMeaningfulShiftItemData(
    item: ShiftItem,
    options?: { autoClientLabel?: string },
): boolean {
    if (item.id) return true;
    if (item.bookingId) return true;
    if (item.serviceAmount && item.serviceAmount > 0) return true;
    if (item.consumablesAmount && item.consumablesAmount > 0) return true;
    if (item.serviceName && item.serviceName.trim() !== '') return true;
    if (item.clientName && item.clientName.trim() !== '') {
        if (!options?.autoClientLabel) {
            return true;
        }

        return !isAutoClientName(item.clientName, options.autoClientLabel);
    }

    return false;
}

export function prepareShiftItemsForSave(
    items: ShiftItem[],
    options?: { autoClientLabel?: string },
): ShiftItem[] {
    return items.filter((item) => hasMeaningfulShiftItemData(item, options));
}

export function mergeShiftItemsWithServer(
    currentLocalItems: ShiftItem[],
    serverItems: ShiftItem[],
): ShiftItem[] {
    const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
    const localItemsById = new Map(
        currentLocalItems.filter((item) => item.id).map((item) => [item.id!, item]),
    );
    const mergedItems: ShiftItem[] = [];

    for (const serverItem of serverItems) {
        if (!serverItem.id) {
            continue;
        }

        const localItem = localItemsById.get(serverItem.id);
        if (localItem) {
            mergedItems.push({
                id: serverItem.id,
                clientName:
                    (localItem.clientName && localItem.clientName.trim()) ||
                    serverItem.clientName ||
                    '',
                serviceName:
                    (localItem.serviceName && localItem.serviceName.trim()) ||
                    serverItem.serviceName ||
                    '',
                serviceAmount:
                    localItem.serviceAmount ?? serverItem.serviceAmount ?? 0,
                consumablesAmount:
                    localItem.consumablesAmount ??
                    serverItem.consumablesAmount ??
                    0,
                bookingId: localItem.bookingId ?? serverItem.bookingId ?? null,
                createdAt: localItem.createdAt || serverItem.createdAt || null,
            });
            continue;
        }

        mergedItems.push(serverItem);
    }

    for (const localItemWithoutId of localItemsWithoutId) {
        const isOnServer = serverItems.some((serverItem) => {
            if (!serverItem.id) return false;

            return (
                serverItem.clientName === localItemWithoutId.clientName &&
                serverItem.serviceName === localItemWithoutId.serviceName &&
                serverItem.serviceAmount === localItemWithoutId.serviceAmount &&
                serverItem.consumablesAmount ===
                    localItemWithoutId.consumablesAmount &&
                serverItem.bookingId === localItemWithoutId.bookingId
            );
        });

        if (!isOnServer) {
            mergedItems.push(localItemWithoutId);
        }
    }

    return mergedItems;
}

function buildStableTimestamp(
    existingItems: ShiftItem[],
    nowMs: number,
): string {
    const lastItemTime =
        existingItems.length > 0 && existingItems[0].createdAt
            ? new Date(existingItems[0].createdAt).getTime()
            : nowMs;
    const timeOffset = nowMs - lastItemTime < 1000 ? 100 : 0;

    return new Date(nowMs + timeOffset).toISOString();
}

export function createNewClientShiftItem(
    existingItems: ShiftItem[],
    clientLabel: string,
    nowMs = Date.now(),
): ShiftItem {
    const usedNames = new Set(
        existingItems.map((it) => it.clientName).filter(Boolean) as string[],
    );
    let nextIndex = 1;
    while (usedNames.has(`${clientLabel} ${nextIndex}`)) {
        nextIndex += 1;
    }

    return {
        clientName: `${clientLabel} ${nextIndex}`,
        serviceName: '',
        serviceAmount: 0,
        consumablesAmount: 0,
        bookingId: null,
        createdAt: buildStableTimestamp(existingItems, nowMs),
    };
}

export function duplicateShiftItem(
    existingItems: ShiftItem[],
    sourceItem: ShiftItem,
    nowMs = Date.now(),
): ShiftItem {
    return {
        clientName: sourceItem.clientName || '',
        serviceName: sourceItem.serviceName || '',
        serviceAmount: sourceItem.serviceAmount ?? 0,
        consumablesAmount: sourceItem.consumablesAmount ?? 0,
        bookingId: null,
        createdAt: buildStableTimestamp(existingItems, nowMs),
    };
}

export function removeShiftItemAtIndex(
    items: ShiftItem[],
    index: number,
): ShiftItem[] {
    return items.filter((_, itemIndex) => itemIndex !== index);
}

export function insertShiftItemAtIndex(
    items: ShiftItem[],
    index: number,
    item: ShiftItem,
): ShiftItem[] {
    const result = [...items];
    result.splice(index, 0, item);
    return result;
}

export function expandItem(expandedItems: Set<number>, index: number): Set<number> {
    return new Set(expandedItems).add(index);
}

export function collapseItem(expandedItems: Set<number>, index: number): Set<number> {
    const next = new Set(expandedItems);
    next.delete(index);
    return next;
}

export function shiftExpandedItemsAfterDelete(
    expandedItems: Set<number>,
    deletedIndex: number,
): Set<number> {
    const next = new Set(expandedItems);
    next.delete(deletedIndex);
    return new Set(Array.from(next).map((index) => (index > deletedIndex ? index - 1 : index)));
}

export function shiftExpandedItemsAfterInsert(
    expandedItems: Set<number>,
    insertedAfterIndex: number,
): Set<number> {
    const shifted = Array.from(expandedItems).map((index) =>
        index > insertedAfterIndex ? index + 1 : index,
    );
    shifted.push(insertedAfterIndex + 1);
    return new Set(shifted);
}
