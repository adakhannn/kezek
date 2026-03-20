import {
    getPastBookings,
    getUpcomingBookings,
    mapApiBookingToBooking,
    mapOfflineBookingToBooking,
} from '../../screens/cabinet/selectors';

jest.mock('@core-domain/booking', () => ({
    isClientActiveBookingStatus: (status: string) => status === 'hold' || status === 'confirmed' || status === 'paid',
    isClientPastBookingStatus: (status: string) => status === 'cancelled' || status === 'no_show' || status === 'paid',
}), { virtual: true });

describe('cabinet selectors', () => {
    test('maps API booking to mobile cabinet shape', () => {
        const booking = mapApiBookingToBooking({
            id: 'booking-1',
            start_at: '2026-03-21T09:00:00.000Z',
            end_at: '2026-03-21T10:00:00.000Z',
            status: 'confirmed',
            service: { name_ru: 'Стрижка' },
            staff: { full_name: 'Анна' },
            branch: { name: 'Центр', address: 'ул. Абая' },
            business: { name: 'Kezek' },
        } as never);

        expect(booking.service?.name_ru).toBe('Стрижка');
        expect(booking.staff?.full_name).toBe('Анна');
        expect(booking.branch?.address).toBe('ул. Абая');
    });

    test('builds upcoming and past booking lists independently from tab state', () => {
        const now = new Date('2026-03-20T12:00:00.000Z');
        const bookings = [
            {
                id: 'upcoming',
                start_at: '2026-03-20T13:00:00.000Z',
                end_at: '2026-03-20T14:00:00.000Z',
                status: 'confirmed',
                service: null,
                staff: null,
                branch: null,
                business: null,
            },
            {
                id: 'past',
                start_at: '2026-03-19T09:00:00.000Z',
                end_at: '2026-03-19T10:00:00.000Z',
                status: 'paid',
                service: null,
                staff: null,
                branch: null,
                business: null,
            },
        ];

        expect(getUpcomingBookings(bookings, now).map((item) => item.id)).toEqual(['upcoming']);
        expect(getPastBookings(bookings, now).map((item) => item.id)).toEqual(['past']);
    });

    test('maps offline booking cache entry to cabinet booking shape', () => {
        const booking = mapOfflineBookingToBooking({
            id: 'offline-1',
            status: 'confirmed',
            start_at: '2026-03-20T09:00:00.000Z',
            end_at: '2026-03-20T10:00:00.000Z',
            branch_name: 'Юг',
            service_name: 'Маникюр',
            staff_name: 'Марина',
            business_name: 'Salon',
            created_at: '2026-03-20T08:00:00.000Z',
        });

        expect(booking.branch?.name).toBe('Юг');
        expect(booking.service?.name_ru).toBe('Маникюр');
        expect(booking.business?.name).toBe('Salon');
    });
});
