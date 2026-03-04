/**
 * Нормализация календарной даты из API (valid_from, valid_to и т.п.).
 * По модели DATE_HANDLING_MODEL: принимаем YYYY-MM-DD и сохраняем как есть,
 * без перевода через toISOString() (избегаем сдвига ±1 день по таймзоне).
 *
 * @param value - строка от клиента (например из <input type="date"> или "YYYY-MM-DD")
 * @returns "YYYY-MM-DD" или null если значение пустое/невалидное
 */
export function toNormalizedDateString(value: string | null | undefined): string | null {
    if (value == null || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length < 10) return null;
    // Принимаем YYYY-MM-DD или начало ISO datetime (YYYY-MM-DD...); берём только дату
    if (/^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }
    return null;
}
