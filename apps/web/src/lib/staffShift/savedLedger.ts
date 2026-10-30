export type ShiftLedgerSnapshotItem = {
    id?: string | null;
    serviceAmount?: number | null;
    service_amount?: number | null;
    amount?: number | null;
    consumablesAmount?: number | null;
    consumables_amount?: number | null;
    bookingId?: string | null;
    booking_id?: string | null;
};

export type SavedShiftLedgerRow = {
    id: string;
    service_amount: number | null;
    consumables_amount: number | null;
    booking_id: string | null;
};

export function savedShiftLedgerItems(rows: SavedShiftLedgerRow[]) {
    return rows.map((row) => ({
        id: row.id,
        serviceAmount: Number(row.service_amount ?? 0),
        consumablesAmount: Number(row.consumables_amount ?? 0),
        bookingId: row.booking_id,
    }));
}

/** Compare the submitted financial snapshot as a multiset, never as a replacement ledger. */
export function matchesSavedShiftLedger(
    snapshot: ShiftLedgerSnapshotItem[],
    saved: ReturnType<typeof savedShiftLedgerItems>,
) {
    const unmatched = [...saved];
    return snapshot.length === saved.length && snapshot.every((item) => {
        const index = unmatched.findIndex((entry) =>
            (!item.id || item.id === entry.id) &&
            Number(item.serviceAmount ?? item.service_amount ?? item.amount ?? 0) === entry.serviceAmount &&
            Number(item.consumablesAmount ?? item.consumables_amount ?? 0) === entry.consumablesAmount &&
            (item.bookingId ?? item.booking_id ?? null) === (entry.bookingId ?? null),
        );
        if (index < 0) return false;
        unmatched.splice(index, 1);
        return true;
    });
}
