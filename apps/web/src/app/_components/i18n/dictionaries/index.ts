/**
 * Централизованный импорт всех словарей по доменам
 * 
 * Структура:
 * - auth.* - авторизация и вход
 * - booking.* - публичный поток бронирования
 * - dashboard.* - дашборд владельца бизнеса
 * - staff.* - управление сотрудниками
 * - services.* - управление услугами
 * - branches.* - управление филиалами
 * - finance.* - финансовая статистика
 * - admin.* - административная панель
 * - common.* - общие ключи
 * - и т.д.
 */

// Auth
import { authKy } from './auth.ky';
import { authRu } from './auth.ru';
import { authEn } from './auth.en';

// Booking
import { bookingKy } from './booking.ky';
import { bookingRu } from './booking.ru';
import { bookingEn } from './booking.en';

// Home
import { homeKy } from './home.ky';
import { homeRu } from './home.ru';
import { homeEn } from './home.en';

// Business
import { businessKy } from './business.ky';
import { businessRu } from './business.ru';
import { businessEn } from './business.en';

// Header
import { headerKy } from './header.ky';
import { headerRu } from './header.ru';
import { headerEn } from './header.en';

// Dashboard
import { dashboardKy } from './dashboard.ky';
import { dashboardRu } from './dashboard.ru';
import { dashboardEn } from './dashboard.en';

// Staff
import { staffKy } from './staff.ky';
import { staffRu } from './staff.ru';
import { staffEn } from './staff.en';

// Services
import { servicesKy } from './services.ky';
import { servicesRu } from './services.ru';
import { servicesEn } from './services.en';

// Branches
import { branchesKy } from './branches.ky';
import { branchesRu } from './branches.ru';
import { branchesEn } from './branches.en';

// Finance
import { financeKy } from './finance.ky';
import { financeRu } from './finance.ru';
import { financeEn } from './finance.en';

// Admin
import { adminKy } from './admin.ky';
import { adminRu } from './admin.ru';
import { adminEn } from './admin.en';

// Common
import { commonKy } from './common.ky';
import { commonRu } from './common.ru';
import { commonEn } from './common.en';

// DatePicker
import { datePickerKy } from './datePicker.ky';
import { datePickerRu } from './datePicker.ru';
import { datePickerEn } from './datePicker.en';

// MonthPicker
import { monthPickerKy } from './monthPicker.ky';
import { monthPickerRu } from './monthPicker.ru';
import { monthPickerEn } from './monthPicker.en';

// TimeRange
import { timeRangeKy } from './timeRange.ky';
import { timeRangeRu } from './timeRange.ru';
import { timeRangeEn } from './timeRange.en';

// Notifications
import { notificationsKy } from './notifications.ky';
import { notificationsRu } from './notifications.ru';
import { notificationsEn } from './notifications.en';

// Bookings
import { bookingsKy } from './bookings.ky';
import { bookingsRu } from './bookings.ru';
import { bookingsEn } from './bookings.en';

// Footer
import { footerKy } from './footer.ky';
import { footerRu } from './footer.ru';
import { footerEn } from './footer.en';

// Cabinet
import { cabinetKy } from './cabinet.ky';
import { cabinetRu } from './cabinet.ru';
import { cabinetEn } from './cabinet.en';

// API Docs
import { apiDocsKy } from './apiDocs.ky';
import { apiDocsRu } from './apiDocs.ru';
import { apiDocsEn } from './apiDocs.en';

// Dev
import { devKy } from './dev.ky';
import { devRu } from './dev.ru';
import { devEn } from './dev.en';

import type { Translations } from '../LanguageProvider';

// Re-export type for convenience
export type { Translations } from '../LanguageProvider';

/**
 * Union-тип всех i18n-ключей
 * Автоматически генерируется из объединенного словаря русского языка (используется как fallback)
 */
export type I18nKey = keyof typeof ru;

/**
 * Объединяет все словари для каждого языка
 */
function mergeDictionaries(...dicts: Translations[]): Translations {
    return Object.assign({}, ...dicts);
}

/**
 * Словари для киргизского языка
 */
export const ky: Translations = mergeDictionaries(
    authKy,
    bookingKy,
    homeKy,
    businessKy,
    headerKy,
    dashboardKy,
    staffKy,
    servicesKy,
    branchesKy,
    financeKy,
    adminKy,
    commonKy,
    datePickerKy,
    monthPickerKy,
    timeRangeKy,
    notificationsKy,
    bookingsKy,
    footerKy,
    cabinetKy,
    apiDocsKy,
    devKy,
);

/**
 * Словари для русского языка
 */
export const ru: Translations = mergeDictionaries(
    authRu,
    bookingRu,
    homeRu,
    businessRu,
    headerRu,
    dashboardRu,
    staffRu,
    servicesRu,
    branchesRu,
    financeRu,
    adminRu,
    commonRu,
    datePickerRu,
    monthPickerRu,
    timeRangeRu,
    notificationsRu,
    bookingsRu,
    footerRu,
    cabinetRu,
    apiDocsRu,
    devRu,
);

/**
 * Словари для английского языка
 */
export const en: Translations = mergeDictionaries(
    authEn,
    bookingEn,
    homeEn,
    businessEn,
    headerEn,
    dashboardEn,
    staffEn,
    servicesEn,
    branchesEn,
    financeEn,
    adminEn,
    commonEn,
    datePickerEn,
    monthPickerEn,
    timeRangeEn,
    notificationsEn,
    bookingsEn,
    footerEn,
    cabinetEn,
    apiDocsEn,
    devEn,
);
