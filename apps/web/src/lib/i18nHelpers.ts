/**
 * Централизованные утилиты для локализации
 * 
 * Реэкспортирует функции из @shared-client/i18n для обратной совместимости
 * 
 * @deprecated Используйте прямые импорты из @shared-client/i18n для новых файлов
 */

// Реэкспорт всех функций и типов из shared-client
export {
    getServiceName,
    formatStaffName,
    getStatusColorWeb as getStatusColor,
    getStatusText,
    transliterate,
} from '@shared-client/i18n';

export type {
    ServiceName,
    BookingStatus,
    StatusColorConfigWeb as StatusColorConfig,
} from '@shared-client/i18n';

