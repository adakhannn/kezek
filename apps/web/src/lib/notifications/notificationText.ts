/**
 * Booking notification texts in the recipient's language (FE-10).
 *
 * The recipient's language is profiles.preferred_locale, saved by POST /api/profile/locale when a
 * signed-in user picks a language on the site. NULL, an unknown value and recipients without a
 * profile (guests, the business notification addresses) get Russian. Times stay in the business
 * timezone; only their format follows the language.
 */
import { formatInTimeZone } from 'date-fns-tz';

import type { NotifyType } from './types';

import { serverNotificationsEn } from '@/app/_components/i18n/dictionaries/serverNotifications.en';
import { serverNotificationsKy } from '@/app/_components/i18n/dictionaries/serverNotifications.ky';
import { serverNotificationsRu } from '@/app/_components/i18n/dictionaries/serverNotifications.ru';

export type NotificationLocale = 'ru' | 'ky' | 'en';

export type NotificationTextKey = keyof typeof serverNotificationsRu;

const DICTIONARIES: Record<NotificationLocale, Readonly<Record<NotificationTextKey, string>>> = {
    ru: serverNotificationsRu,
    ky: serverNotificationsKy,
    en: serverNotificationsEn,
};

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

/** The notification language for a stored preference: Russian unless it is ky or en. */
export function notificationLocale(value: unknown): NotificationLocale {
    return value === 'ky' || value === 'en' ? value : 'ru';
}

/** The text of `key` in `locale`, with its {placeholders} replaced by `values`. */
export function notificationText(
    locale: NotificationLocale,
    key: NotificationTextKey,
    values?: Record<string, string | number>,
): string {
    const template = DICTIONARIES[locale]?.[key] ?? serverNotificationsRu[key];
    if (!values) return template;
    return template.replace(PLACEHOLDER, (whole, name: string) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole);
}

const TITLE_KEYS: Record<NotifyType, NotificationTextKey> = {
    hold: 'server.notifications.titleHold',
    confirm: 'server.notifications.titleConfirm',
    cancel: 'server.notifications.titleCancel',
};

/** The message title of a notification type ("Бронь подтверждена"). */
export function notificationTitle(type: NotifyType, locale: NotificationLocale): string {
    return notificationText(locale, TITLE_KEYS[type]);
}

const STATUS_KEYS: Record<string, NotificationTextKey> = {
    hold: 'server.notifications.statusHold',
    confirmed: 'server.notifications.statusConfirmed',
    paid: 'server.notifications.statusPaid',
    cancelled: 'server.notifications.statusCancelled',
};

/** A booking status for people; an unknown status is shown as it is. */
export function notificationStatus(status: string, locale: NotificationLocale): string {
    const key = Object.prototype.hasOwnProperty.call(STATUS_KEYS, status) ? STATUS_KEYS[status] : undefined;
    return key ? notificationText(locale, key) : status;
}

// Numeric dates read naturally in Russian and Kyrgyz; English gets the month name, which avoids
// the day/month ambiguity of 01.02.
const DATE_TIME_FORMAT: Record<NotificationLocale, string> = {
    ru: 'dd.MM.yyyy HH:mm',
    ky: 'dd.MM.yyyy HH:mm',
    en: 'd MMM yyyy, HH:mm',
};

/** Date and time of `iso` in the business timezone. */
export function formatNotificationDateTime(iso: string, timezone: string, locale: NotificationLocale): string {
    return formatInTimeZone(new Date(iso), timezone, DATE_TIME_FORMAT[locale]);
}

/** Time of `iso` in the business timezone. */
export function formatNotificationTime(iso: string, timezone: string): string {
    return formatInTimeZone(new Date(iso), timezone, 'HH:mm');
}

/** The service name in `locale`, falling back to Russian and then to the word "service". */
export function notificationServiceName(
    service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null,
    locale: NotificationLocale,
): string {
    const localized = locale === 'ky' ? service?.name_ky : locale === 'en' ? service?.name_en : null;
    return localized?.trim() ? localized : service?.name_ru ?? notificationText(locale, 'server.notifications.service');
}
