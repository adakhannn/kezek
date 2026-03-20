import {
    buildBookingTimeline,
    canClientCancelBooking,
    isClientActiveBookingStatus,
    isClientPastBookingStatus,
} from '../clientSemantics';

describe('booking/clientSemantics', () => {
    test('treats hold and confirmed as active for client flows', () => {
        expect(isClientActiveBookingStatus('hold')).toBe(true);
        expect(isClientActiveBookingStatus('confirmed')).toBe(true);
        expect(isClientActiveBookingStatus('paid')).toBe(false);
        expect(isClientActiveBookingStatus('cancelled')).toBe(false);
        expect(isClientActiveBookingStatus('no_show')).toBe(false);
    });

    test('treats terminal statuses as past for client flows', () => {
        expect(isClientPastBookingStatus('paid')).toBe(true);
        expect(isClientPastBookingStatus('cancelled')).toBe(true);
        expect(isClientPastBookingStatus('no_show')).toBe(true);
        expect(isClientPastBookingStatus('hold')).toBe(false);
    });

    test('reuses canonical cancelability semantics', () => {
        expect(canClientCancelBooking('hold')).toBe(true);
        expect(canClientCancelBooking('confirmed')).toBe(true);
        expect(canClientCancelBooking('paid')).toBe(false);
    });

    test('builds timeline for a confirmed booking', () => {
        expect(buildBookingTimeline({ status: 'confirmed' })).toEqual([
            { key: 'created', done: true },
            { key: 'confirmed', done: true },
            { key: 'completed', done: false },
            { key: 'promo', done: false },
        ]);
    });

    test('builds timeline for a cancelled booking without fake confirmation step', () => {
        expect(buildBookingTimeline({ status: 'cancelled' })).toEqual([
            { key: 'created', done: true },
            { key: 'confirmed', done: false },
            { key: 'cancelled', done: true },
            { key: 'promo', done: false },
        ]);
    });

    test('builds timeline for a paid booking with applied promotion', () => {
        expect(buildBookingTimeline({ status: 'paid', hasPromotionApplied: true })).toEqual([
            { key: 'created', done: true },
            { key: 'confirmed', done: true },
            { key: 'completed', done: true },
            { key: 'promo', done: true },
        ]);
    });
});
