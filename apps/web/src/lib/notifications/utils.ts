// apps/web/src/lib/notifications/utils.ts

import { notificationText, type NotificationLocale } from './notificationText';
import type { RoleKey } from './types';

import { escapeHtml } from '@/lib/htmlEscape';

/**
 * Извлекает первый элемент из массива или возвращает сам элемент
 */
export function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Нормализует список email адресов
 */
export function normalizeEmails(list: (string | null | undefined)[]): string[] {
    return Array.from(
        new Set(
            list
                .filter(Boolean)
                .map((e) => String(e).trim().toLowerCase())
                .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        )
    );
}

/**
 * Формирует приветствие
 */
export function greet(name?: string | null, locale: NotificationLocale = 'ru'): string {
    return name?.trim()
        ? notificationText(locale, 'server.notifications.greeting', { name })
        : notificationText(locale, 'server.notifications.greetingNoName');
}

/**
 * Название роли получателя
 */
export function roleLabel(role: RoleKey, locale: NotificationLocale = 'ru'): string {
    switch (role) {
        case 'client': return notificationText(locale, 'server.notifications.roleClient');
        case 'staff':  return notificationText(locale, 'server.notifications.master');
        case 'owner':  return notificationText(locale, 'server.notifications.roleOwner');
        default:       return notificationText(locale, 'server.notifications.roleAdmin');
    }
}

/**
 * Персонализирует HTML письмо, добавляя приветствие
 */
export function buildHtmlPersonal(
    baseHtml: string,
    name: string | null | undefined,
    role: RoleKey,
    locale: NotificationLocale = 'ru',
): string {
    const header =
        `<p style="margin:0 0 12px 0">${escapeHtml(greet(name, locale))} <i>(${escapeHtml(roleLabel(role, locale))})</i></p>`;

    // Вставляем приветствие внутрь первого <div ...>, после закрывающего символа '>'
    const idx = baseHtml.indexOf('>');
    if (idx === -1) return baseHtml; // на всякий случай

    return baseHtml.slice(0, idx + 1) + header + baseHtml.slice(idx + 1);
}

