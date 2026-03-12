/**
 * Zod схемы для валидации данных бронирования
 */

import { z } from 'zod';

import { uuidSchema, nameSchema, phoneSchema, emailSchema, isoDateTimeSchema } from './schemas';

/**
 * Схема для quick-hold (быстрое бронирование для авторизованных).
 * Либо service_id (одна услуга), либо services (массив для комплекса).
 * Поле service_id остаётся обязательным для домена, но на уровне API
 * мы допускаем, что клиент может передать только services — в этом
 * случае service_id будет подставлен из первой услуги.
 */
export const quickHoldSchema = z
    .object({
        biz_id: uuidSchema,
        branch_id: uuidSchema.optional(),
        service_id: uuidSchema.optional(),
        services: z
            .array(
                z.object({
                    service_id: uuidSchema,
                    duration_min: z.number().int().positive(),
                    order_index: z.number().int().min(0).optional(),
                }),
            )
            .optional(),
        staff_id: uuidSchema,
        start_at: isoDateTimeSchema,
    })
    .refine(
        (data) =>
            (typeof data.service_id === 'string' && data.service_id.length > 0) ||
            (Array.isArray(data.services) && data.services.length > 0),
        { message: 'Either service_id or non-empty services array is required' },
    );

const bookingServiceItemSchema = z.object({
    service_id: uuidSchema,
    duration_min: z.number().int().positive(),
    order_index: z.number().int().min(0).optional(),
});

/**
 * Схема для quick-book-guest (гостевое бронирование).
 * Либо service_id (одна услуга), либо services (массив для комплекса).
 */
export const quickBookGuestSchema = z
    .object({
        biz_id: uuidSchema,
        branch_id: uuidSchema,
        service_id: uuidSchema.optional(),
        services: z.array(bookingServiceItemSchema).optional(),
        staff_id: uuidSchema,
        start_at: isoDateTimeSchema,
        client_name: nameSchema,
        client_phone: phoneSchema,
        client_email: emailSchema.optional().nullable(),
    })
    .refine(
        (data) =>
            (typeof data.service_id === 'string' && data.service_id.length > 0) ||
            (Array.isArray(data.services) && data.services.length > 0),
        { message: 'Either service_id or non-empty services array is required' }
    );

/**
 * Схема для отметки посещения
 */
export const markAttendanceSchema = z.object({
    booking_id: uuidSchema,
    attended: z.boolean(),
});

