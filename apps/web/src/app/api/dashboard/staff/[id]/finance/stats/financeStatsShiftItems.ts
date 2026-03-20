import { logError } from '@/lib/log';

export type FinanceStatsShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

type AdminLikeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

export async function loadFinanceStatsShiftItems(
    admin: AdminLikeClient,
    shiftIds: string[]
): Promise<Record<string, FinanceStatsShiftItem[]>> {
    const shiftItemsMap: Record<string, FinanceStatsShiftItem[]> = {};

    if (shiftIds.length === 0) {
        return shiftItemsMap;
    }

    const { data: itemsData, error: itemsError } = await admin
        .from('staff_shift_items')
        .select('id, shift_id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
        .in('shift_id', shiftIds)
        .order('created_at', { ascending: true });

    if (itemsError) {
        logError('StaffFinanceStats', 'Error loading shift items', itemsError);
        return shiftItemsMap;
    }

    for (const item of itemsData || []) {
        const shiftId = item.shift_id;
        if (!shiftItemsMap[shiftId]) {
            shiftItemsMap[shiftId] = [];
        }
        shiftItemsMap[shiftId].push({
            id: item.id,
            client_name: item.client_name,
            service_name: item.service_name,
            service_amount: Number(item.service_amount ?? 0),
            consumables_amount: Number(item.consumables_amount ?? 0),
            note: item.note,
            booking_id: item.booking_id,
            created_at: item.created_at ?? null,
        });
    }

    return shiftItemsMap;
}
