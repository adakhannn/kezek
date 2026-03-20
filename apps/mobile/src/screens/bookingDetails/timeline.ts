import { buildBookingTimeline, type BookingTimelineStepKey } from '@core-domain/booking';

export function getTimelineLabel(stepKey: BookingTimelineStepKey): string {
    switch (stepKey) {
        case 'created':
            return 'Создано';
        case 'confirmed':
            return 'Подтверждено';
        case 'completed':
            return 'Завершено';
        case 'cancelled':
            return 'Отменено';
        case 'no_show':
            return 'Не пришёл';
        case 'promo':
            return 'Промо применено';
        default:
            return '';
    }
}

export function getBookingTimelineSteps(status: string, hasPromotionApplied = false) {
    return buildBookingTimeline({
        status,
        hasPromotionApplied,
    }).map((step) => ({
        ...step,
        label: getTimelineLabel(step.key),
    }));
}
