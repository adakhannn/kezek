import {
    computeBookingPresetFilters,
    matchesBookingSearchQuery,
    matchesBookingStatusFilter,
    type BookingListItem,
} from '../dashboardFilters';

describe('booking/dashboardFilters', () => {
    describe('matchesBookingStatusFilter', () => {
        const statuses: Array<{ status: any; filter: any; expected: boolean }> = [
            { status: 'hold', filter: 'all', expected: true },
            { status: 'cancelled', filter: 'all', expected: false },
            { status: 'confirmed', filter: 'active', expected: true },
            { status: 'paid', filter: 'active', expected: false },
            { status: 'hold', filter: 'holdConfirmed', expected: true },
            { status: 'confirmed', filter: 'holdConfirmed', expected: true },
            { status: 'paid', filter: 'holdConfirmed', expected: false },
            { status: 'paid', filter: 'paid', expected: true },
            { status: 'no_show', filter: 'no_show', expected: true },
        ];

        it.each(statuses)(
            'status %s with filter %s should be %s',
            ({ status, filter, expected }) => {
                expect(matchesBookingStatusFilter(status, filter)).toBe(expected);
            },
        );
    });

    describe('matchesBookingSearchQuery', () => {
        const base: BookingListItem = {
            id: '123',
            status: 'confirmed',
            start_at: '2024-01-01T10:00:00Z',
            services: [{ name_ru: 'Стрижка' }],
            staff: [{ full_name: 'Иван Иванов' }],
            client_name: 'Пётр Петров',
            client_phone: '+996555000111',
        };

        it('matches by service name', () => {
            expect(matchesBookingSearchQuery(base, 'стриж')).toBe(true);
        });

        it('matches by staff name', () => {
            expect(matchesBookingSearchQuery(base, 'иванов')).toBe(true);
        });

        it('matches by client name', () => {
            expect(matchesBookingSearchQuery(base, 'петр')).toBe(true);
        });

        it('matches by phone', () => {
            expect(matchesBookingSearchQuery(base, '555000111')).toBe(true);
        });

        it('matches by id', () => {
            expect(matchesBookingSearchQuery(base, '123')).toBe(true);
        });

        it('returns false when nothing matches', () => {
            expect(matchesBookingSearchQuery(base, 'абракадабра')).toBe(false);
        });
    });

    describe('computeBookingPresetFilters', () => {
        it('returns today dateFilter for today preset', () => {
            const { dateFilter } = computeBookingPresetFilters('today', 'Asia/Bishkek');
            expect(dateFilter).toBeDefined();
            expect(dateFilter!.gte).toMatch(/T00:00:00$/);
            expect(dateFilter!.lte).toMatch(/T23:59:59$/);
        });

        it('returns staffFilter for myStaff preset when staffId provided', () => {
            const { staffFilter } = computeBookingPresetFilters('myStaff', 'Asia/Bishkek', 'staff-1');
            expect(staffFilter).toBe('staff-1');
        });

        it('returns empty for myStaff when no staffId', () => {
            const result = computeBookingPresetFilters('myStaff', 'Asia/Bishkek', null);
            expect(result.staffFilter).toBeUndefined();
        });

        it('returns holdConfirmed statusFilter for holdConfirmed preset', () => {
            const { statusFilter } = computeBookingPresetFilters('holdConfirmed', 'Asia/Bishkek');
            expect(statusFilter).toBe('holdConfirmed');
        });

        it('returns empty object for null preset', () => {
            const result = computeBookingPresetFilters(null, 'Asia/Bishkek');
            expect(result).toEqual({});
        });
    });
});
