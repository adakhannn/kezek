/**
 * Централизованные утилиты для локализации
 * Используются для единообразного отображения названий услуг, имен сотрудников и статусов
 */

import { transliterate } from './transliterate';

/**
 * Тип для услуги с многоязычными названиями
 */
export type ServiceName = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
};

/**
 * Получает правильное название услуги с учетом языка
 * 
 * @param service - Объект услуги с полями name_ru, name_ky, name_en или строка
 * @param locale - Язык интерфейса ('ru' | 'ky' | 'en')
 * @returns Название услуги на выбранном языке или транслитерированное для английского
 * 
 * @example
 * getServiceName({ name_ru: 'Стрижка', name_ky: 'Кесим', name_en: 'Haircut' }, 'ky') // 'Кесим'
 * getServiceName({ name_ru: 'Стрижка', name_ky: null, name_en: null }, 'en') // 'Strizhka' (транслитерация)
 * getServiceName({ name_ru: 'Стрижка' }, 'ru') // 'Стрижка'
 */
export function getServiceName(service: ServiceName | string | null | undefined, locale: 'ru' | 'ky' | 'en'): string {
    if (!service) return '';
    
    // Если это строка (вручную введенное название), используем транслитерацию для английского
    if (typeof service === 'string') {
        if (locale === 'en') return transliterate(service);
        return service;
    }
    
    // Для киргизского языка: приоритет name_ky, fallback на name_ru
    if (locale === 'ky' && service.name_ky) return service.name_ky;
    
    // Для английского языка: приоритет name_en, fallback на транслитерацию name_ru
    if (locale === 'en') {
        if (service.name_en) return service.name_en;
        return transliterate(service.name_ru);
    }
    
    // Для русского языка и всех остальных случаев: возвращаем name_ru
    return service.name_ru;
}

/**
 * Форматирует имя сотрудника с учетом языка
 * 
 * @param name - Имя сотрудника
 * @param locale - Язык интерфейса ('ru' | 'ky' | 'en')
 * @returns Имя сотрудника на выбранном языке или транслитерированное для английского
 * 
 * @example
 * formatStaffName('Иван Петров', 'en') // 'Ivan Petrov'
 * formatStaffName('Иван Петров', 'ru') // 'Иван Петров'
 * formatStaffName(null, 'ru') // ''
 */
export function formatStaffName(name: string | null | undefined, locale: 'ru' | 'ky' | 'en'): string {
    if (!name) return '';
    if (locale === 'en') return transliterate(name);
    return name;
}

/**
 * Тип статуса бронирования
 */
export type BookingStatus = 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';

/**
 * Конфигурация цветов для статусов бронирований
 */
export type StatusColorConfig = {
    className: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
};

/**
 * Получает конфигурацию цветов для статуса бронирования
 * 
 * @param status - Статус бронирования
 * @returns Конфигурация с CSS классами для фона, текста и границы
 * 
 * @example
 * getStatusColor('hold') // { className: 'bg-yellow-100 text-yellow-800 ...', ... }
 * getStatusColor('paid') // { className: 'bg-green-100 text-green-800 ...', ... }
 */
export function getStatusColor(status: BookingStatus | string): StatusColorConfig {
    const configs: Record<BookingStatus, StatusColorConfig> = {
        hold: {
            className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800',
            bgColor: 'yellow',
            textColor: 'yellow',
            borderColor: 'yellow',
        },
        confirmed: {
            className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800',
            bgColor: 'blue',
            textColor: 'blue',
            borderColor: 'blue',
        },
        paid: {
            className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800',
            bgColor: 'green',
            textColor: 'green',
            borderColor: 'green',
        },
        cancelled: {
            className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700',
            bgColor: 'gray',
            textColor: 'gray',
            borderColor: 'gray',
        },
        no_show: {
            className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800',
            bgColor: 'red',
            textColor: 'red',
            borderColor: 'red',
        },
    };
    
    // Возвращаем конфигурацию для известного статуса или дефолтную для неизвестного
    return configs[status as BookingStatus] || configs.cancelled;
}

