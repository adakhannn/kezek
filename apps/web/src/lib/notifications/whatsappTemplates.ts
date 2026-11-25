import { buildWhatsAppTemplateParameters, type BookingDetails } from './messageBuilders';
import type { NotificationLocale } from './notificationText';
import type { BookingEventType } from './types';

import { getWhatsAppBookingTemplateLanguage, getWhatsAppBookingTemplateName } from '@/lib/env';
import { logDebug } from '@/lib/log';

/**
 * Booking WhatsApp messages are approved Meta templates (R25-07): free-form text reaches a number
 * only inside the 24-hour window after that person wrote to the business, so a confirmation sent
 * as text was accepted by the API and then silently not delivered. Template bodies and the
 * parameter order are listed in docs/OWNER_ACTIONS.md §6 and the notifications README.
 */
const TEMPLATE_KIND: Partial<Record<BookingEventType, 'confirmed' | 'cancelled' | 'reminder'>> = {
    confirm: 'confirmed',
    cancel: 'cancelled',
    reminder_24h: 'reminder',
    reminder_2h: 'reminder',
};

const reportedUnconfigured = new Set<BookingEventType>();

/** The template of an event type, or null when none is configured (no WhatsApp delivery is planned). */
export function bookingWhatsAppTemplateName(type: BookingEventType): string | null {
    const kind = TEMPLATE_KIND[type];
    const name = kind ? getWhatsAppBookingTemplateName(kind) : '';
    if (name) return name;
    if (!reportedUnconfigured.has(type)) {
        reportedUnconfigured.add(type);
        logDebug('BookingWhatsAppTemplates', 'No WhatsApp template is configured for this booking event; WhatsApp is skipped', { type });
    }
    return null;
}

/**
 * The translation a recipient gets: their own language when its Meta language code is configured,
 * otherwise the default translation, whose parameters are then rendered in the default language.
 */
export function bookingWhatsAppTemplateLanguage(recipient: NotificationLocale): { code: string; locale: NotificationLocale } {
    if (recipient !== 'ru') {
        const code = getWhatsAppBookingTemplateLanguage(recipient);
        if (code) return { code, locale: recipient };
    }
    const code = getWhatsAppBookingTemplateLanguage('default');
    const lower = code.toLowerCase();
    return { code, locale: lower.startsWith('ky') ? 'ky' : lower.startsWith('en') ? 'en' : 'ru' };
}

/** Graph API payload of one booking template message. */
export function buildBookingWhatsAppTemplatePayload(
    phone: string,
    details: BookingDetails,
    type: BookingEventType,
    templateName: string,
    recipient: NotificationLocale,
): Record<string, unknown> {
    const { code, locale } = bookingWhatsAppTemplateLanguage(recipient);
    return {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template',
        template: {
            name: templateName,
            language: { code },
            components: [{
                type: 'body',
                parameters: buildWhatsAppTemplateParameters(details, type, locale).map(text => ({ type: 'text', text })),
            }],
        },
    };
}
