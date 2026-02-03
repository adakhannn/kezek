/**
 * Zod схемы для валидации данных бронирования
 */

import { z } from 'zod';

import { uuidSchema, nameSchema, phoneSchema, emailSchema, isoDateTimeSchema } from './schemas';

/**
 * Схема для quick-hold (быстрое бронирование для авторизованных)
 */
export const quickHoldSchema = z.object({
    biz_id: uuidSchema,
    branch_id: uuidSchema.optional(),
    service_id: uuidSchema,
    staff_id: uuidSchema,
    start_at: isoDateTimeSchema,
});

/**
 * Схема для quick-book-guest (гостевое бронирование)
 */
export const quickBookGuestSchema = z.object({
    biz_id: uuidSchema,
    service_id: uuidSchema,
    staff_id: uuidSchema,
    start_at: isoDateTimeSchema,
    client_name: nameSchema,
    client_phone: phoneSchema,
    client_email: emailSchema.optional().nullable(),
});

/**
 * Схема для отметки посещения
 */
export const markAttendanceSchema = z.object({
    booking_id: uuidSchema,
    attended: z.boolean(),
});

