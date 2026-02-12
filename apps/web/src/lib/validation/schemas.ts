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
 * Zod .datetime() принимает формат ISO 8601: YYYY-MM-DDTHH:mm:ss[+-]HH:mm или YYYY-MM-DDTHH:mm:ssZ
 * Поддерживает форматы с двоеточием и без в оффсете
 */
export const isoDateTimeSchema = z.string().refine(
    (val) => {
        // Проверяем различные форматы ISO 8601
        const isoPatterns = [
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, // UTC
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, // С двоеточием в оффсете
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/, // Без двоеточия в оффсете
        ];
        return isoPatterns.some(pattern => pattern.test(val));
    },
    { message: 'Invalid ISO datetime format' }
);

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

/**
 * Дата в формате YYYY-MM-DD
 */
export const dateStringSchema = z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Date must be in YYYY-MM-DD format'
).refine(
    (val) => {
        const [year, month, day] = val.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            return false;
        }
        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }
        const testDate = new Date(year, month - 1, day);
        return testDate.getFullYear() === year && 
               testDate.getMonth() === month - 1 && 
               testDate.getDate() === day;
    },
    { message: 'Invalid date (e.g., day does not exist in month)' }
);

/**
 * Схема для одного элемента смены (shift item)
 * 
 * Синхронизирована с TypeScript типом ShiftItem и валидацией на фронтенде.
 * Поля clientName и serviceName опциональны, так как:
 * - clientName может быть пустым, если есть bookingId
 * - serviceName опционально
 * - Максимальная длина 200 символов (как в валидации на фронтенде)
 */
export const shiftItemSchema = z.object({
    id: z.string().uuid().optional().nullable(),
    clientName: z.union([
        z.string().max(200, 'Client name too long (maximum 200 characters)'),
        z.literal(''),
        z.null(),
    ]).optional(),
    serviceName: z.union([
        z.string().max(200, 'Service name too long (maximum 200 characters)'),
        z.literal(''),
        z.null(),
    ]).optional(),
    serviceAmount: z.number()
        .nonnegative('Service amount cannot be negative')
        .max(100000000, 'Service amount too large (maximum 100,000,000)')
        .default(0),
    consumablesAmount: z.number()
        .nonnegative('Consumables amount cannot be negative')
        .max(100000000, 'Consumables amount too large (maximum 100,000,000)')
        .default(0),
    bookingId: z.string().uuid().optional().nullable(),
    createdAt: z.string().optional().nullable(),
}).strict();

/**
 * Схема для массива элементов смены
 */
export const shiftItemsArraySchema = z.array(shiftItemSchema).max(1000, 'Too many items (maximum 1000)');

/**
 * Схема для запроса сохранения элементов смены
 */
export const saveShiftItemsSchema = z.object({
    items: shiftItemsArraySchema,
    staffId: z.string().uuid().optional(),
    shiftDate: dateStringSchema.optional(),
}).strict();

/**
 * Схема для запроса закрытия смены
 */
export const closeShiftSchema = z.object({
    items: shiftItemsArraySchema.optional(),
    totalAmount: z.number().nonnegative('Total amount cannot be negative').optional(),
    consumablesAmount: z.number().nonnegative('Consumables amount cannot be negative').optional(),
}).strict().refine(
    (data) => {
        // Либо items, либо totalAmount должны быть указаны
        return (data.items && data.items.length > 0) || (data.totalAmount !== undefined && data.totalAmount !== null);
    },
    { message: 'Either items array or totalAmount must be provided' }
);

