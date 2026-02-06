// apps/web/src/lib/notifications/utils.ts

import type { RoleKey } from './types';

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
export function greet(name?: string | null): string {
    return name?.trim() ? `Здравствуйте, ${name}!` : `Здравствуйте!`;
}

/**
 * Переводит роль на русский
 */
export function roleRu(role: RoleKey): string {
    switch (role) {
        case 'client': return 'Клиент';
        case 'staff':  return 'Мастер';
        case 'owner':  return 'Владелец';
        default:       return 'Администратор';
    }
}

/**
 * Переводит статус бронирования на русский
 */
export function statusRu(status: string): string {
    switch (status) {
        case 'hold':
            return 'Ожидает подтверждения';
        case 'confirmed':
            return 'Подтверждена';
        case 'paid':
            return 'Выполнена';
        case 'cancelled':
            return 'Отменена';
        default:
            return status;
    }
}

/**
 * Персонализирует HTML письмо, добавляя приветствие
 */
export function buildHtmlPersonal(
    baseHtml: string,
    name: string | null | undefined,
    role: RoleKey
): string {
    const header =
        `<p style="margin:0 0 12px 0">${greet(name)} <i>(${roleRu(role)})</i></p>`;

    // Вставляем приветствие внутрь первого <div ...>, после закрывающего символа '>'
    const idx = baseHtml.indexOf('>');
    if (idx === -1) return baseHtml; // на всякий случай

    return baseHtml.slice(0, idx + 1) + header + baseHtml.slice(idx + 1);
}

