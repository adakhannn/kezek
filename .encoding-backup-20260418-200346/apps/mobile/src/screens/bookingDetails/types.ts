import type { ClientBookingDetailsDto } from '@shared-client/types';

export type BookingDetails = ClientBookingDetailsDto;

export type TimelineStep = {
    key: string;
    label: string;
    done: boolean;
};

export function buildTimelineSteps(status: string): TimelineStep[] {
    return [
        { key: 'created', label: '???????', done: true },
        {
            key: 'confirmed',
            label: 'Подтверждено',
            done: status === 'confirmed' || status === 'paid',
        },
        {
            key: 'completed',
            label: status === 'cancelled' ? '????????' : '?????????',
            done: status === 'paid' || status === 'cancelled',
        },
        {
            key: 'promo',
            label: 'Промо применено',
            done: false,
        },
    ];
}
