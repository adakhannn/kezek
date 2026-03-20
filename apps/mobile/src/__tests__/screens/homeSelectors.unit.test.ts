jest.mock('@core-domain/booking', () => ({
    isClientActiveBookingStatus: (status: string) => ['hold', 'confirmed', 'paid'].includes(status),
}), { virtual: true });

import { getAvailableCategories, getRecentPlaces, getUpcomingBookings } from '../../screens/home/selectors';

describe('home selectors', () => {
    it('returns upcoming active bookings sorted by start time', () => {
        const now = new Date('2026-03-20T10:00:00.000Z');
        const bookings = [
            {
                id: 'late',
                start_at: '2026-03-20T12:00:00.000Z',
                end_at: '2026-03-20T13:00:00.000Z',
                status: 'confirmed',
                business: { name: 'B', slug: 'b' },
                branch: null,
                service: null,
            },
            {
                id: 'soon',
                start_at: '2026-03-20T11:00:00.000Z',
                end_at: '2026-03-20T12:00:00.000Z',
                status: 'paid',
                business: { name: 'A', slug: 'a' },
                branch: null,
                service: null,
            },
            {
                id: 'past',
                start_at: '2026-03-20T09:00:00.000Z',
                end_at: '2026-03-20T10:00:00.000Z',
                status: 'confirmed',
                business: { name: 'C', slug: 'c' },
                branch: null,
                service: null,
            },
            {
                id: 'cancelled',
                start_at: '2026-03-20T14:00:00.000Z',
                end_at: '2026-03-20T15:00:00.000Z',
                status: 'cancelled',
                business: { name: 'D', slug: 'd' },
                branch: null,
                service: null,
            },
        ];

        expect(getUpcomingBookings(bookings, now).map((booking) => booking.id)).toEqual(['soon', 'late']);
    });

    it('returns unique recent places in reverse chronological order', () => {
        const bookings = [
            {
                id: '1',
                start_at: '2026-03-20T12:00:00.000Z',
                end_at: '2026-03-20T13:00:00.000Z',
                status: 'confirmed',
                business: { name: 'Salon B', slug: 'salon-b' },
                branch: null,
                service: null,
            },
            {
                id: '2',
                start_at: '2026-03-21T12:00:00.000Z',
                end_at: '2026-03-21T13:00:00.000Z',
                status: 'confirmed',
                business: { name: 'Salon A', slug: 'salon-a' },
                branch: null,
                service: null,
            },
            {
                id: '3',
                start_at: '2026-03-22T12:00:00.000Z',
                end_at: '2026-03-22T13:00:00.000Z',
                status: 'confirmed',
                business: { name: 'Salon B', slug: 'salon-b' },
                branch: null,
                service: null,
            },
        ];

        expect(getRecentPlaces(bookings)).toEqual([
            { slug: 'salon-b', name: 'Salon B' },
            { slug: 'salon-a', name: 'Salon A' },
        ]);
    });

    it('collects sorted unique categories', () => {
        const businesses = [
            { id: '1', name: 'A', slug: 'a', address: null, phones: null, categories: ['Spa', 'Hair'], rating_score: null },
            { id: '2', name: 'B', slug: 'b', address: null, phones: null, categories: ['Hair', 'Nails'], rating_score: null },
        ];

        expect(getAvailableCategories(businesses)).toEqual(['Hair', 'Nails', 'Spa']);
    });
});
