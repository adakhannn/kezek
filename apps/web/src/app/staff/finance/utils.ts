// apps/web/src/app/staff/finance/utils.ts

import type { ServiceName } from './types';

import { formatTime as formatTimeLib } from '@/lib/dateFormat';
import { transliterate } from '@/lib/transliterate';

/**
 * Форматирует время из ISO строки
 * Использует унифицированную функцию из @/lib/dateFormat
 */
export function formatTime(iso: string | null, locale: string): string {
    if (!iso) return '—';
    try {
        // Используем унифицированную функцию форматирования времени
        return formatTimeLib(iso, locale as 'ru' | 'ky' | 'en');
    } catch {
        return '—';
    }
}

/**
 * Убирает повторяющиеся названия услуг в строке вида "Услуга A + Услуга A + Услуга B" → "Услуга A + Услуга B".
 * Сохраняет порядок первого вхождения.
 */
export function deduplicateServiceNameString(serviceName: string | null | undefined): string {
    if (!serviceName || typeof serviceName !== 'string') return '';
    const parts = serviceName.split('+').map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
        if (!seen.has(p)) {
            seen.add(p);
            unique.push(p);
        }
    }
    return unique.join(' + ');
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

