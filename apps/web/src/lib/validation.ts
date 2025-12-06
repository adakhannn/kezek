/**
 * Утилиты для валидации данных
 */

/**
 * Проверяет, является ли строка валидным UUID
 */
export function isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Проверяет, является ли строка валидным email адресом
 */
export function isEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Проверяет, является ли строка валидным телефоном в формате E.164
 * Формат: +[1-9][0-9]{1,14} (например, +996555123456)
 */
export function isE164(s: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(s);
}

/**
 * Валидирует координаты широты и долготы
 * @returns { ok: false } если координаты невалидны
 * @returns { ok: true, lat: number, lon: number } если координаты валидны
 */
export function validateLatLon(lat: unknown, lon: unknown): { ok: false } | { ok: true; lat: number; lon: number } {
    if (lat == null || lon == null) return { ok: false };
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return { ok: false };
    if (la < -90 || la > 90 || lo < -180 || lo > 180) return { ok: false };
    return { ok: true, lat: la, lon: lo };
}

/**
 * Преобразует координаты в формат EWKT для PostGIS
 * @param lat - широта
 * @param lon - долгота
 * @returns строка в формате SRID=4326;POINT(lon lat)
 */
export function coordsToEWKT(lat: number, lon: number): string {
    return `SRID=4326;POINT(${lon} ${lat})`;
}

/**
 * Нормализует строку (убирает пробелы, возвращает null если пусто)
 */
export function normalizeString(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

