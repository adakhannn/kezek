/**
 * Общие Zod схемы для валидации данных в API routes
 */

import { z } from 'zod';

/**
 * UUID валидация
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email валидация
 */
export const emailSchema = z.string().email('Invalid email format').max(255, 'Email too long').optional().nullable();

/**
 * Телефон в формате E.164
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g., +996555123456)');

/**
 * Имя (2-100 символов)
 */
export const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long');

/**
 * ISO дата-время строка
 */
export const isoDateTimeSchema = z.string().datetime('Invalid ISO datetime format');

/**
 * Положительное число
 */
export const positiveNumberSchema = z.number().positive('Must be a positive number');

/**
 * Неотрицательное число
 */
export const nonNegativeNumberSchema = z.number().nonnegative('Must be a non-negative number');

/**
 * Slug (латиница, цифры, дефисы)
 */
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').min(1).max(100);

/**
 * URL
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Координаты (широта, долгота)
 */
export const latSchema = z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90');
export const lonSchema = z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180');

/**
 * Массив UUID
 */
export const uuidArraySchema = z.array(uuidSchema).min(1, 'At least one UUID required');

