/**
 * Shared Client Package
 * 
 * Общие утилиты для web и mobile приложений:
 * - безопасное логирование
 * - валидация данных
 * - базовые типы DTO
 * 
 * Использование:
 * 
 * ```typescript
 * // Web
 * import { createLogger } from '@shared-client/log';
 * const { logDebug, logWarn, logError } = createLogger(() => process.env.NODE_ENV !== 'production');
 * 
 * // Mobile
 * import { createLogger } from '@shared-client/log';
 * const { logDebug, logWarn, logError } = createLogger(() => __DEV__);
 * 
 * // Валидация
 * import { validateEmail, validatePhone, isUuid } from '@shared-client/validation';
 * 
 * // Типы
 * import type { BookingDto, Slot, StaffInfo } from '@shared-client/types';
 * ```
 */

// Логирование
export { createLogger, maskToken, maskUrl, sanitizeObject } from './log';
export type { IsDevFn } from './log';

// Валидация
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
} from './validation';

// Типы
export type {
    BookingStatus,
    PromotionType,
    PromotionApplied,
    BookingDto,
    PromotionDto,
    Slot,
    TemporaryTransfer,
    StaffInfo,
    BranchInfo,
    ServiceInfo,
} from './types';

// API клиент
export {
    createApiClient,
    ApiError,
} from './api';
export type {
    ApiClientConfig,
    ApiRequestOptions,
    ApiSuccessResponse,
    ApiErrorResponse,
    ApiResponse,
} from './api';

// i18n хэлперы
export {
    getServiceName,
    formatStaffName,
    getStatusColorWeb,
    getStatusColorMobile,
    getStatusText,
    transliterate,
} from './i18n';
export type {
    ServiceName,
    BookingStatus,
    StatusColorConfigWeb,
    StatusColorConfigMobile,
} from './i18n';

