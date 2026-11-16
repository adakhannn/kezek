/**
 * Утилиты для SEO: hreflang, метаданные
 */

import { getPublicSiteOrigin } from './siteOrigin';

type Locale = 'ky' | 'ru' | 'en';

/**
 * Получает базовый URL сайта (NEXT_PUBLIC_SITE_ORIGIN)
 */
export function getBaseUrl(): string {
    return getPublicSiteOrigin();
}

/**
 * Генерирует hreflang-ссылки для трех языков
 * @param path - путь без локали (например, '/', '/b/slug', '/b/slug/booking')
 * @returns объект с hreflang-ссылками для использования в Metadata.alternates.languages
 */
export function generateHreflangLinks(path: string): Record<Locale, string> {
    const baseUrl = getBaseUrl();
    // Убираем начальный и конечный слэши для консистентности
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const fullPath = cleanPath ? `/${cleanPath}` : '/';
    
    return {
        ky: `${baseUrl}${fullPath}`,
        ru: `${baseUrl}${fullPath}`,
        en: `${baseUrl}${fullPath}`,
    };
}

/**
 * Генерирует объект Metadata.alternates для Next.js
 * @param path - путь без локали
 */
export function generateAlternates(path: string) {
    return {
        languages: generateHreflangLinks(path),
    };
}

