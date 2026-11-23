/**
 * Kyrgyz calendar words for i18n/kyDate.ts (not a dictionary group). They live in this folder
 * because they are Kyrgyz text, which scripts/check-i18n.mjs does not look for here.
 */

/** Kyrgyz weekday names, Monday first (ISO weekday 1..7). */
export const KY_WEEKDAYS = ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби'] as const;
/** Short Kyrgyz weekday names, Monday first, as in the website calendar. */
export const KY_WEEKDAYS_SHORT = ['Дш', 'Шш', 'Шр', 'Бш', 'Жм', 'Иш', 'Жк'] as const;
/** Kyrgyz month names, January first. */
export const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const;

/** A year in a Kyrgyz date: "2026-ж.". */
export const kyYearLabel = (year: string) => `${year}-ж.`;
