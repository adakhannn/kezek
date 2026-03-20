import { canCancel } from './statusTransitions';
import type { BookingStatus } from './types';

export type BookingTimelineStepKey =
    | 'created'
    | 'confirmed'
    | 'completed'
    | 'cancelled'
    | 'no_show'
    | 'promo';

export type BookingTimelineStep = {
    key: BookingTimelineStepKey;
    done: boolean;
};

export function isClientActiveBookingStatus(status: BookingStatus): boolean {
    return status === 'hold' || status === 'confirmed';
}

export function isClientPastBookingStatus(status: BookingStatus): boolean {
    return status === 'paid' || status === 'cancelled' || status === 'no_show';
}

export function canClientCancelBooking(status: BookingStatus): boolean {
    return canCancel(status);
}

export function buildBookingTimeline(params: {
    status: BookingStatus;
    hasPromotionApplied?: boolean;
}): BookingTimelineStep[] {
    const { status, hasPromotionApplied = false } = params;

    const finalStepKey: BookingTimelineStepKey =
        status === 'cancelled' ? 'cancelled' : status === 'no_show' ? 'no_show' : 'completed';

    return [
        { key: 'created', done: true },
        {
            key: 'confirmed',
            done: status === 'confirmed' || status === 'paid' || status === 'no_show',
        },
        {
            key: finalStepKey,
            done: status === 'paid' || status === 'cancelled' || status === 'no_show',
        },
        {
            key: 'promo',
            done: hasPromotionApplied && status === 'paid',
        },
    ];
}
