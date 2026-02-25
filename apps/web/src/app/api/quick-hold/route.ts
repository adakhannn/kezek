import {
    validateCreateBookingParams,
    createBookingUseCase,
    type BookingCommandsPort,
    type BookingNotificationPort,
} from '@core-domain/booking';
import { createClient } from '@supabase/supabase-js';

import {
    withErrorHandler,
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { SupabaseBranchRepository } from '@/lib/repositories';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickHoldSchema } from '@/lib/validation/bookingSchemas';

/**
 * @swagger
 * /api/quick-hold:
 *   post:
 *     summary: Быстрое создание бронирования (hold) для авторизованных пользователей
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - biz_id
 *               - service_id
 *               - staff_id
 *               - start_at
 *             properties:
 *               biz_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID бизнеса
 *               branch_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID филиала (опционально, если не указан - берется первый активный)
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID услуги
 *               staff_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID мастера
 *               start_at:
 *                 type: string
 *                 format: date-time
 *                 description: Время начала в формате ISO с таймзоной
 *                 example: "2024-01-15T10:00:00+06:00"
 *     responses:
 *       '200':
 *         description: Бронирование успешно создано
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 booking_id:
 *                   type: string
 *                   format: uuid
 *                 confirmed:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Неверные параметры или ошибка создания
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '401':
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '429':
 *         description: Превышен лимит запросов
 */
export async function POST(req: Request) {
    // Применяем rate limiting для публичного endpoint
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        async () => {
            return withErrorHandler('QuickHold', async () => {
            const url = getSupabaseUrl();
            const anon = getSupabaseAnonKey();
            
            // Проверяем, есть ли Bearer token в заголовках (для мобильного приложения)
            const authHeader = req.headers.get('Authorization');
            const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            
    let supabase;
    let user;
            
            if (bearerToken) {
        // Для мобильного приложения: создаем клиент с токеном в заголовках
        supabase = createClient(url, anon, {
            global: {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        // Проверяем токен через getUser (он автоматически использует токен из заголовков)
        const {data: {user: userData}, error: userError} = await supabase.auth.getUser();
        if (userError || !userData) {
            logError('QuickHold', 'Bearer token auth failed', {
                error: userError?.message || 'No user',
                hasToken: !!bearerToken,
                tokenLength: bearerToken?.length,
                // Токен автоматически замаскируется через sanitizeObject
            });
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        user = userData;
        logDebug('QuickHold', 'Bearer token auth successful', { userId: user.id });
    } else {
        // Для веб-версии: используем унифицированную утилиту
        supabase = await createSupabaseServerClient();
        const {data: {user: userData}} = await supabase.auth.getUser();
        if (!userData) {
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        user = userData;
    }

    // Валидация входных данных через Zod схему
    const validationResult = await validateRequest(req, quickHoldSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }
    
    // Дополнительная доменная валидация (структура/бизнес-инварианты)
    const domainValidation = validateCreateBookingParams(validationResult.data);
    if (!domainValidation.valid || !domainValidation.data) {
        return createErrorResponse(
            'validation',
            domainValidation.error || 'Неверные параметры бронирования',
            undefined,
            400,
        );
    }

    const branchRepository = new SupabaseBranchRepository(supabase);

    const commands: BookingCommandsPort = {
        async holdSlot({ bizId, branchId, serviceId, staffId, startAt }) {
            logDebug('QuickHold', 'Calling hold_slot RPC', { userId: user.id });

            const { data: rpcData, error } = await supabase.rpc('hold_slot', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_service_id: serviceId,
                p_staff_id: staffId,
                p_start: startAt,
            });

            if (error) {
                logError('QuickHold', 'RPC error', error);
                throw new Error(error.message);
            }

            // RPC возвращает booking_id строкой
            if (typeof rpcData !== 'string' || !rpcData) {
                logError('QuickHold', 'Unexpected RPC result shape', { rpcData });
                throw new Error('Unexpected RPC result shape');
            }

            logDebug('QuickHold', 'RPC success', { bookingId: rpcData });
            return rpcData;
        },
        async confirmBooking(bookingId) {
            logDebug('QuickHold', 'Attempting to confirm booking', { bookingId });

            const { error: confirmError } = await supabase.rpc('confirm_booking', {
                p_booking_id: bookingId,
            });

            if (confirmError) {
                logError('QuickHold', 'Failed to confirm booking', {
                    error: confirmError.message,
                    code: confirmError.code,
                    details: confirmError.details,
                    hint: confirmError.hint,
                });
                throw new Error(confirmError.message);
            }

            logDebug('QuickHold', 'Booking confirmed successfully', { bookingId });
        },
        async cancelBooking() {
            // В этом endpoint не используется
        },
    };

    const notifications: BookingNotificationPort = {
        async send(bookingId, type) {
            await notifyHold(bookingId, req, type);
            logDebug('QuickHold', 'Notification sent successfully from use-case', {
                bookingId,
                type,
            });
        },
    };

    const result = await createBookingUseCase(
        {
            branchRepository,
            commands,
            notifications,
        },
        domainValidation.data,
    );

            return createSuccessResponse({
                booking_id: result.bookingId,
                confirmed: true,
            });
            });
        }
    );
}

async function notifyHold(bookingId: string, req: Request, type: 'hold' | 'confirm' | 'cancel' = 'hold') {
    try {
        const notifyUrl = new URL('/api/notify', req.url);
        logDebug('QuickHold', 'Calling notify API', { url: notifyUrl.toString(), type, bookingId });
        
        const response = await fetch(notifyUrl, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({type, booking_id: bookingId}),
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError('QuickHold', 'Notify API error', { status: response.status, errorText });
        } else {
            const result = await response.json().catch(() => ({}));
            logDebug('QuickHold', 'Notify API success', result);
        }
    } catch (error) {
        logError('QuickHold', 'Notify API exception', error);
    }
}


