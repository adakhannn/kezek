export type ShiftItem = {
    id?: string;
    clientId?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    createdAt?: string | null;
    note?: string | null;
};

export type TodayShift = {
    exists: boolean;
    status: 'open' | 'closed' | 'none';
    shift: {
        id: string;
        ledger_revision: number;
        shift_date: string;
        status: 'open' | 'closed';
        opened_at: string | null;
        total_amount: number;
        consumables_amount: number;
        master_share: number;
        salon_share: number;
        hours_worked: number | null;
        hourly_rate: number | null;
        guaranteed_amount: number;
    } | null;
    items: ShiftItem[];
};

export type FinanceData = {
    today: TodayShift;
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
};

export type ShiftItemInput = Omit<ShiftItem, 'id' | 'createdAt'>;
export type ShiftLedgerSnapshot = {
    expectedShiftId: string;
    expectedRevision: number;
    items: ShiftItem[];
};
export type ShiftItemsCommand = ShiftLedgerSnapshot;
export type ShiftCloseCommand = ShiftLedgerSnapshot & { totalAmount: number; consumablesAmount: number };
export type ShiftItemEdit = {
    base: ShiftLedgerSnapshot;
    item: ShiftItemInput;
    itemId?: string;
    replacesQueuedAt?: string;
};
export type SavedShiftLedger = { shiftId: string; revision: number; items: ShiftItem[] };

export type ShiftQuickMetrics = {
    totalAmount: number;
    totalConsumables: number;
    finalMasterShare: number;
    finalSalonShare: number;
    topupAmount: number;
    baseMasterShare: number;
    currentGuaranteed: number;
};
