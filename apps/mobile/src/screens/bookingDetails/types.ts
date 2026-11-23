import type { ClientBookingDetailsDto } from '@shared-client/types';

import type { MobileI18nKey } from '../../i18n';

export type BookingDetails = ClientBookingDetailsDto;

export type TimelineStep = {
    key: string;
    /** Translated with t() at render. */
    labelKey: MobileI18nKey;
    done: boolean;
};

export function buildTimelineSteps(status: string): TimelineStep[] {
    return [
        { key: 'created', labelKey: 'cabinet.details.timeline.created', done: true },
        {
            key: 'confirmed',
            labelKey: 'cabinet.details.timeline.confirmed',
            done: status === 'confirmed' || status === 'paid',
        },
        {
            key: 'completed',
            labelKey: status === 'cancelled' ? 'cabinet.details.timeline.cancelled' : 'cabinet.details.timeline.completed',
            done: status === 'paid' || status === 'cancelled',
        },
        {
            key: 'promo',
            labelKey: 'cabinet.details.timeline.promo',
            done: false,
        },
    ];
}
