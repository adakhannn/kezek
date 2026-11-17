jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { filterStaffForService } from '../../screens/booking/useBookingStep3Staff';

const staff = [{ id: 'cutter' }, { id: 'colorist' }, { id: 'new' }];

describe('filterStaffForService (MOB-01)', () => {
    test('offers only the masters linked to the chosen service', () => {
        const links = [
            { service_id: 'cut', staff_id: 'cutter' },
            { service_id: 'color', staff_id: 'colorist' },
            { service_id: 'cut', staff_id: 'other-branch' },
        ];

        expect(filterStaffForService(staff, links, 'cut')).toEqual([{ id: 'cutter' }]);
        expect(filterStaffForService(staff, links, 'color')).toEqual([{ id: 'colorist' }]);
        expect(filterStaffForService(staff, links, 'manicure')).toEqual([]);
    });

    test('keeps every master when the business never linked services to staff', () => {
        expect(filterStaffForService(staff, [], 'cut')).toEqual(staff);
    });

    test('keeps the list until a service is chosen', () => {
        expect(filterStaffForService(staff, [{ service_id: 'cut', staff_id: 'cutter' }], null)).toEqual(staff);
    });
});
