/**
 * Централизованные утилиты для локализации в mobile приложении
 * 
 * Использует функции из @shared-client/i18n для единообразия с web версией
 */

import {
    getServiceName as getServiceNameShared,
    getLocalizedText as getLocalizedTextShared,
    getPromotionTitle as getPromotionTitleShared,
    formatStaffName as formatStaffNameShared,
    getStatusColorMobile,
    getStatusText as getStatusTextShared,
    type LocalizedText,
    type ServiceName,
} from '@shared-client/i18n';

export type { LocalizedText, ServiceName };

/**
 * Название услуги на языке интерфейса: name_ky/name_en, если бизнес их заполнил, иначе name_ru
 * (для en — транслитерация name_ru), как на сайте.
 */
export function getServiceName(
    service: ServiceName | string | null | undefined,
    locale: 'ru' | 'ky' | 'en' = 'ru'
): string {
    return getServiceNameShared(service, locale);
}

/** Текст каталога (ru/ky/en) на языке интерфейса с fallback на русский. */
export function getLocalizedText(text: LocalizedText | null | undefined, locale: 'ru' | 'ky' | 'en' = 'ru'): string {
    return getLocalizedTextShared(text, locale);
}

/** Заголовок акции (title_ru/title_ky/title_en) на языке интерфейса с fallback на русский. */
export function getPromotionTitle(
    promotion: { title_ru?: string | null; title_ky?: string | null; title_en?: string | null } | null | undefined,
    locale: 'ru' | 'ky' | 'en' = 'ru'
): string {
    return getPromotionTitleShared(promotion, locale);
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
