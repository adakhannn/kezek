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

export type {
    BookingStatusFilter,
    BookingListItem,
    BookingPresetFilters,
    BookingFilterPreset,
} from './dashboardFilters';
export type { BookingTimelineStepKey, BookingTimelineStep } from './clientSemantics';

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

export {
    matchesBookingStatusFilter,
    matchesBookingSearchQuery,
    computeBookingPresetFilters,
} from './dashboardFilters';
export {
    isClientActiveBookingStatus,
    isClientPastBookingStatus,
    canClientCancelBooking,
    buildBookingTimeline,
} from './clientSemantics';

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

