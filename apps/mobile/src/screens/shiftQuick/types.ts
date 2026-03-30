export type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    createdAt?: string | null;
};

export type TodayShift = {
    exists: boolean;
    status: 'open' | 'closed' | 'none';
    shift: {
        id: string;
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

export type ShiftQuickMetrics = {
    totalAmount: number;
    totalConsumables: number;
    finalMasterShare: number;
    finalSalonShare: number;
    topupAmount: number;
    baseMasterShare: number;
    currentGuaranteed: number;
};
