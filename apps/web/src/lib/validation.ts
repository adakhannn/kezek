/**
 * Утилиты для валидации данных на клиенте.
 *
 * Реэкспортирует функции из @shared-client/validation для обратной совместимости.
 * Все функции теперь используют общий код из shared-client пакета.
 *
 * @deprecated Для новых файлов используйте прямой импорт из @shared-client/validation
 */

// Реэкспортируем все функции валидации из shared-client
export {
    isUuid,
    isEmail,
    isE164,
    validateLatLon,
    coordsToEWKT,
    validateEmail,
    validatePhone,
    validateName,
    validatePositiveNumber,
    validatePercent,
    validatePriceRange,
    validatePercentSum,
} from '@shared-client/validation';
