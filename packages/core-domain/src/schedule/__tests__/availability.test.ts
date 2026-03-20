import { filterStaffByBookingAvailability } from '../availability';

type Staff = {
    id: string;
    branch_id: string;
    name: string;
};

describe('filterStaffByBookingAvailability', () => {
    const staff: Staff[] = [
        { id: 's1', branch_id: 'b1', name: 'A' },
        { id: 's2', branch_id: 'b1', name: 'B' },
        { id: 's3', branch_id: 'b2', name: 'C' },
    ];

    test('returns branch staff when day is not selected', () => {
        const result = filterStaffByBookingAvailability({
            staff,
            staffByBranch: staff.filter((member) => member.branch_id === 'b1'),
            branchId: 'b1',
            temporaryTransfers: [],
        });

        expect(result.map((member) => member.id)).toEqual(['s1', 's2']);
    });

    test('adds staff transferred into branch for selected day', () => {
        const result = filterStaffByBookingAvailability({
            staff,
            staffByBranch: staff.filter((member) => member.branch_id === 'b1'),
            branchId: 'b1',
            dayStr: '2026-03-19',
            temporaryTransfers: [{ staff_id: 's3', branch_id: 'b1', date: '2026-03-19' }],
        });

        expect(result.map((member) => member.id)).toEqual(['s1', 's2', 's3']);
    });

    test('excludes staff transferred out to another branch for selected day', () => {
        const result = filterStaffByBookingAvailability({
            staff,
            staffByBranch: staff.filter((member) => member.branch_id === 'b1'),
            branchId: 'b1',
            dayStr: '2026-03-19',
            temporaryTransfers: [{ staff_id: 's2', branch_id: 'b2', date: '2026-03-19' }],
        });

        expect(result.map((member) => member.id)).toEqual(['s1']);
    });

    test('returns empty list when branch is not selected', () => {
        const result = filterStaffByBookingAvailability({
            staff,
            staffByBranch: staff.filter((member) => member.branch_id === 'b1'),
            branchId: '',
            dayStr: '2026-03-19',
            temporaryTransfers: [],
        });

        expect(result).toEqual([]);
    });
});
