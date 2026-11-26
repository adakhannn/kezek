import type { ClientBookingDetailsDto } from '@shared-client/types';

import type { MobileI18nKey } from '../../i18n';

export type BookingDetails = ClientBookingDetailsDto;

export type TimelineStep = {
    key: string;
    /** Translated with t() at render. */
    labelKey: MobileI18nKey;
    done: boolean;
};

/**
 * B6: the "promo applied" step was always shown and never done. It is shown only for a booking
 * with a promotion, done once the visit is paid (when the discount is charged), as on the web card.
 */
export function buildTimelineSteps(status: string, promotionApplied = false): TimelineStep[] {
    const steps: TimelineStep[] = [
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
    ];
    if (promotionApplied && status !== 'cancelled') {
        steps.push({ key: 'promo', labelKey: 'cabinet.details.timeline.promo', done: status === 'paid' });
    }
    return steps;
}
