import { logError } from '@/lib/log';

export type FinanceByIdShiftItemRow = {
    id: string;
    client_name: string | null;
    service_name: string | null;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

type AdminLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                order: (column: string, options: { ascending: boolean }) => {
                    order: (column: string, options: { ascending: boolean }) => Promise<{
                        data: FinanceByIdShiftItemRow[] | null;
                        error: unknown;
                    }>;
                };
            };
        };
    };
};

export async function loadFinanceByIdShiftItems(
    admin: AdminLikeClient,
    shiftId: string | null | undefined
): Promise<FinanceByIdShiftItemRow[]> {
    if (!shiftId) {
        return [];
    }

    const { data: itemsData, error: itemsError } = await admin
        .from('staff_shift_items')
        .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (itemsError) {
        logError('StaffFinance', 'Error loading shift items', itemsError);
        return [];
    }

    return Array.isArray(itemsData) ? itemsData : [];
}
