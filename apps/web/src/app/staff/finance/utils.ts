// apps/web/src/app/staff/finance/utils.ts

import type { ServiceName } from './types';

import { transliterate } from '@/lib/transliterate';

/**
 * Форматирует время из ISO строки
 */
export function formatTime(iso: string | null, locale: string): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        const localeMap: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-US' };
        return d.toLocaleTimeString(localeMap[locale] || 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

/**
 * Получает правильное название услуги с учетом языка
 */
export function getServiceName(service: ServiceName | string, locale: string): string {
    if (typeof service === 'string') {
        // Если это строка (вручную введенное название), используем транслитерацию для английского
        if (locale === 'en') return transliterate(service);
        return service;
    }
    
    if (locale === 'ky' && service.name_ky) return service.name_ky;
    if (locale === 'en' && service.name_en) return service.name_en;
    if (locale === 'en') return transliterate(service.name_ru);
    return service.name_ru;
}

