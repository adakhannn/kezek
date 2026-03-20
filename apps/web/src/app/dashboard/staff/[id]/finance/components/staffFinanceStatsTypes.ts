export type ShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

export type Shift = {
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    late_minutes: number;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number;
    items: ShiftItem[];
};

export type Period = 'day' | 'month' | 'year';

export type Stats = {
    period: Period;
    dateFrom: string;
    dateTo: string;
    staffName: string;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalClients: number;
    totalBaseMasterShare?: number;
    totalGuaranteedAmount?: number;
    hasGuaranteedPayment?: boolean;
    shifts: Shift[];
};
