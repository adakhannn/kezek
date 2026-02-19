/**
 * Утилиты для SEO: hreflang, метаданные
 */

type Locale = 'ky' | 'ru' | 'en';

/**
 * Получает базовый URL сайта
 */
export function getBaseUrl(): string {
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL;
    }
    if (typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.host}`;
    }
    return 'https://kezek.app';
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

