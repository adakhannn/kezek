import {
    matchesStatusFilter,
    matchesSearchQuery,
    computePresetFilters,
    type BookingListItem,
} from '@/lib/dashboardBookingsLogic';

describe('dashboardBookingsLogic', () => {
    describe('matchesStatusFilter', () => {
        const statuses: Array<{ status: any; filter: any; expected: boolean }> = [
            { status: 'hold',        filter: 'all',          expected: true },
            { status: 'cancelled',   filter: 'all',          expected: false },
            { status: 'confirmed',   filter: 'active',       expected: true },
            { status: 'paid',        filter: 'active',       expected: false },
            { status: 'hold',        filter: 'holdConfirmed', expected: true },
            { status: 'confirmed',   filter: 'holdConfirmed', expected: true },
            { status: 'paid',        filter: 'holdConfirmed', expected: false },
            { status: 'paid',        filter: 'paid',         expected: true },
            { status: 'no_show',     filter: 'no_show',      expected: true },
        ];

        it.each(statuses)(
            'status %s with filter %s should be %s',
            ({ status, filter, expected }) => {
                expect(matchesStatusFilter(status, filter)).toBe(expected);
            },
        );
    });

    describe('matchesSearchQuery', () => {
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
            expect(matchesSearchQuery(base, 'стриж')).toBe(true);
        });

        it('matches by staff name', () => {
            expect(matchesSearchQuery(base, 'иванов')).toBe(true);
        });

        it('matches by client name', () => {
            expect(matchesSearchQuery(base, 'петр')).toBe(true);
        });

        it('matches by phone', () => {
            expect(matchesSearchQuery(base, '555000111')).toBe(true);
        });

        it('matches by id', () => {
            expect(matchesSearchQuery(base, '123')).toBe(true);
        });

        it('returns false when nothing matches', () => {
            expect(matchesSearchQuery(base, 'абракадабра')).toBe(false);
        });
    });

    describe('computePresetFilters', () => {
        it('returns today dateFilter for today preset', () => {
            const { dateFilter } = computePresetFilters('today', 'Asia/Bishkek');
            expect(dateFilter).toBeDefined();
            expect(dateFilter!.gte).toMatch(/T00:00:00$/);
            expect(dateFilter!.lte).toMatch(/T23:59:59$/);
        });

        it('returns staffFilter for myStaff preset when staffId provided', () => {
            const { staffFilter } = computePresetFilters('myStaff', 'Asia/Bishkek', 'staff-1');
            expect(staffFilter).toBe('staff-1');
        });

        it('returns empty for myStaff when no staffId', () => {
            const result = computePresetFilters('myStaff', 'Asia/Bishkek', null);
            expect(result.staffFilter).toBeUndefined();
        });

        it('returns holdConfirmed statusFilter for holdConfirmed preset', () => {
            const { statusFilter } = computePresetFilters('holdConfirmed', 'Asia/Bishkek');
            expect(statusFilter).toBe('holdConfirmed');
        });

        it('returns empty object for null preset', () => {
            const result = computePresetFilters(null, 'Asia/Bishkek');
            expect(result).toEqual({});
        });
    });
});

