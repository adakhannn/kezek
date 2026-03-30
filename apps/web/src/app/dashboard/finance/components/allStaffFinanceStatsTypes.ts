export type Period = 'day' | 'month' | 'year';

export type StaffStat = {
    staffId: string;
    staffName: string;
    isActive: boolean;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
};

export type TotalStats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalShifts: number;
    totalOpenShifts: number;
    totalClosedShifts: number;
};

export type BranchOption = {
    id: string;
    name: string;
};
