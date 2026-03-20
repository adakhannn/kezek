import { getAutoSelectedBranchId } from '../../screens/booking/bookingInitHelpers';

describe('booking init helpers', () => {
    it('returns the only branch id when there is exactly one branch', () => {
        expect(getAutoSelectedBranchId([{ id: 'branch-1' }])).toBe('branch-1');
    });

    it('returns null when there are multiple branches', () => {
        expect(getAutoSelectedBranchId([{ id: 'branch-1' }, { id: 'branch-2' }])).toBeNull();
    });

    it('returns null when there are no branches', () => {
        expect(getAutoSelectedBranchId([])).toBeNull();
    });
});
