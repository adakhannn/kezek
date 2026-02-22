/**
 * Централизованные утилиты для локализации в mobile приложении
 * 
 * Использует функции из @shared-client/i18n для единообразия с web версией
 */

import {
    getServiceName as getServiceNameShared,
    formatStaffName as formatStaffNameShared,
    getStatusColorMobile,
    getStatusText as getStatusTextShared,
} from '@shared-client/i18n';

/**
 * Получает название услуги с учетом текущего языка
 */
export function getServiceName(
    service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | string | null | undefined,
    locale: 'ru' | 'ky' | 'en' = 'ru'
): string {
    return getServiceNameShared(service, locale);
}

/**
 * Форматирует имя сотрудника с учетом текущего языка
 */
export function formatStaffName(name: string | null | undefined, locale: 'ru' | 'ky' | 'en' = 'ru'): string {
    return formatStaffNameShared(name, locale);
}

/**
 * Получает hex цвет для статуса бронирования
 */
export function getStatusColor(status: string): string {
    return getStatusColorMobile(status);
}

/**
 * Получает текст статуса бронирования с учетом текущего языка
 */
export function getStatusText(status: string, locale: 'ru' | 'ky' | 'en' = 'ru'): string {
    return getStatusTextShared(status, locale);
}

