import type { StaffInfo, TemporaryTransfer } from './types';

export function filterStaffByBookingAvailability<T extends StaffInfo>(params: {
    staff: T[];
    staffByBranch: T[];
    branchId: string;
    dayStr?: string;
    temporaryTransfers: TemporaryTransfer[];
}): T[] {
    const { staff, staffByBranch, branchId, dayStr, temporaryTransfers } = params;

    if (!branchId) {
        return [];
    }

    if (!dayStr) {
        return staffByBranch;
    }

    const mainStaffIds = new Set(staffByBranch.map((member) => member.id));
    const transfersForDay = temporaryTransfers.filter((transfer) => transfer.date === dayStr);
    const tempStaffIdsToThisBranch = new Set(
        transfersForDay
            .filter((transfer) => transfer.branch_id === branchId)
            .map((transfer) => transfer.staff_id),
    );
    const tempStaffIdsToOtherBranch = new Set(
        transfersForDay
            .filter((transfer) => transfer.branch_id !== branchId)
            .map((transfer) => transfer.staff_id),
    );

    const allStaffIds = new Set([...mainStaffIds, ...tempStaffIdsToThisBranch]);

    return staff.filter((member) => {
        const isIncluded = allStaffIds.has(member.id);
        const isTransferredToOther = tempStaffIdsToOtherBranch.has(member.id);
        return isIncluded && !isTransferredToOther;
    });
}
