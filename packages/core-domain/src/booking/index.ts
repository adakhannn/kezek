/**
 * Доменный модуль для бронирований и промоакций
 * 
 * Содержит чистые функции для:
 * - валидации данных бронирований
 * - преобразования структур БД в DTO
 * - работы с промоакциями
 * 
 * Не содержит зависимостей от Supabase-клиента или HTTP-слоя.
 */

// Типы
export type {
    BookingStatus,
    PromotionType,
    PromotionParams,
    PromotionApplied,
    CreateBookingParams,
    CreateGuestBookingParams,
    UpdateBookingStatusParams,
    PromotionApplicationResult,
} from './types';

// DTO
export type {
    BookingDto,
    PromotionDto,
} from './dto';

export {
    transformBookingToDto,
    normalizePromotionApplied,
    transformPromotionToDto,
} from './dto';

// Валидация
export type { BranchForBookingCheck } from './validation';
export {
    validateCreateBookingParams,
    validateCreateGuestBookingParams,
    validatePromotionParams,
    validateBranchForBooking,
    extractBookingId,
} from './validation';

// Правила переходов статусов
export type { CanMarkAttendanceContext, CanChangeStatusOptions } from './statusTransitions';
export {
    isTerminalStatus,
    canCancel,
    canConfirm,
    canMarkAttendance,
    canChangeStatus,
} from './statusTransitions';

// Application use-cases
export type {
    BookingCommandsPort,
    BookingNotificationPort,
    MarkAttendanceParams,
    MarkAttendanceDecision,
    BookingErrorKind,
    BookingError,
    CreateBookingResult,
} from './useCases';

export {
    createBookingUseCase,
    cancelBookingUseCase,
    confirmBookingUseCase,
    sendBookingNotificationsUseCase,
    decideMarkAttendanceUseCase,
} from './useCases';

