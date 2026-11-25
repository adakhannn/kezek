/**
 * Notification texts in the recipient's language (FE-10): booking, shift-close and
 * role-application/invitation messages.
 *
 * The recipient's language is profiles.preferred_locale, saved by POST /api/profile/locale when a
 * signed-in user picks a language on the site. NULL, an unknown value and recipients without a
 * profile (guests, the business notification addresses) get Russian. Times stay in the business
 * timezone; only their format follows the language.
 */
import { formatInTimeZone } from 'date-fns-tz';

import type { BookingEventType } from './types';

import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { serverNotificationsEn } from '@/app/_components/i18n/dictionaries/serverNotifications.en';
import { serverNotificationsKy } from '@/app/_components/i18n/dictionaries/serverNotifications.ky';
import { serverNotificationsRu } from '@/app/_components/i18n/dictionaries/serverNotifications.ru';
import { formatKyDate } from '@/lib/kyDateFormat';

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

const TITLE_KEYS: Record<BookingEventType, NotificationTextKey> = {
    hold: 'server.notifications.titleHold',
    confirm: 'server.notifications.titleConfirm',
    cancel: 'server.notifications.titleCancel',
    reminder_24h: 'server.notifications.titleReminder',
    reminder_2h: 'server.notifications.titleReminder',
};

/** The message title of a notification type ("Бронь подтверждена"). */
export function notificationTitle(type: BookingEventType, locale: NotificationLocale): string {
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

/**
 * A calendar date in `timezone`: dd.MM.yyyy in Russian, the same numeric date in Kyrgyz
 * through kyDateFormat (never Intl 'ky-KG', which many runtimes lack), "20 Nov 2026" in English.
 */
export function formatNotificationDate(value: string, timezone: string, locale: NotificationLocale): string {
    // A bare YYYY-MM-DD (a shift date) is already a day of the business calendar: shown as is, never
    // shifted by a zone (midnight UTC is the previous day west of Greenwich, ARCH-11).
    const calendarDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = calendarDay ? new Date(`${value}T12:00:00Z`) : new Date(value);
    const zone = calendarDay ? 'UTC' : timezone;
    if (locale === 'ky') return formatKyDate(date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: zone });
    return formatInTimeZone(date, zone, locale === 'en' ? 'd MMM yyyy' : 'dd.MM.yyyy');
}

const MONEY: Record<NotificationLocale, string> = {
    ru: financeRu['finance.money'],
    ky: financeKy['finance.money'],
    en: financeEn['finance.money'],
};

/** An amount with two decimals in the finance.money style of `locale` ("1500.00 сом", "1500.00 som"). */
export function formatNotificationMoney(amount: number, locale: NotificationLocale): string {
    return MONEY[locale].replace('{amount}', amount.toFixed(2));
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
