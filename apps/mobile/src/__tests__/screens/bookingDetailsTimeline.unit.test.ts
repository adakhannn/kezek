import { getBookingTimelineSteps, getTimelineLabel } from '../../screens/bookingDetails/timeline';

jest.mock('@core-domain/booking', () => ({
    buildBookingTimeline: ({ status }: { status: string }) => {
        if (status === 'confirmed') {
            return [
                { key: 'created', done: true },
                { key: 'confirmed', done: true },
                { key: 'completed', done: false },
            ];
        }

        return [
            { key: 'created', done: true },
            { key: 'cancelled', done: true },
        ];
    },
}), { virtual: true });

describe('booking details timeline helpers', () => {
    test('returns localized label for known timeline steps', () => {
        expect(getTimelineLabel('created')).toBe('Создано');
        expect(getTimelineLabel('confirmed')).toBe('Подтверждено');
        expect(getTimelineLabel('promo')).toBe('Промо применено');
    });

    test('maps core-domain timeline to UI labels', () => {
        expect(getBookingTimelineSteps('confirmed')).toEqual([
            { key: 'created', done: true, label: 'Создано' },
            { key: 'confirmed', done: true, label: 'Подтверждено' },
            { key: 'completed', done: false, label: 'Завершено' },
        ]);
    });
});
