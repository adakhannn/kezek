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

// Re-export type for convenience
export type { Translations } from '../LanguageProvider';

import { ru } from './ru';

export { en } from './en';
export { ky } from './ky';
export { ru };

export type I18nKey = keyof typeof ru;
