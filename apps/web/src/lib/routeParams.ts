/**
 * Утилиты для безопасного получения params из route handlers Next.js
 */

/**
 * Извлекает params из context route handler.
 * Поддерживает как синхронные, так и асинхронные params (Next.js 15/16).
 */
export async function getRouteParams<T extends Record<string, string>>(
    context: unknown
): Promise<T> {
    if (!context || typeof context !== 'object' || !('params' in context)) {
        return {} as T;
    }

    const params = (context as { params: T | Promise<T> }).params;

    // Если params - Promise (Next.js 15/16), ждём его
    if (params instanceof Promise) {
        return await params;
    }

    // Иначе возвращаем как есть
    return params as T;
}

/**
 * Извлекает один параметр по ключу.
 */
export async function getRouteParam(
    context: unknown,
    key: string
): Promise<string | undefined> {
    const params = await getRouteParams<Record<string, string>>(context);
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Извлекает один параметр по ключу с обязательной проверкой.
 * Бросает ошибку, если параметр отсутствует.
 */
export async function getRouteParamRequired(
    context: unknown,
    key: string
): Promise<string> {
    const value = await getRouteParam(context, key);
    if (!value) {
        throw new Error(`Missing required route parameter: ${key}`);
    }
    return value;
}

