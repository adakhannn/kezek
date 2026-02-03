import {createServerClient} from "@supabase/ssr";
import {createClient} from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
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
type HoldSlotArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_service_id: string;
    p_staff_id: string;
    p_start: string; // ISO-строка с таймзоной
};

export async function POST(req: Request) {
    // Применяем rate limiting для публичного endpoint
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        async () => {
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
        // Для веб-версии: используем cookies
        const cookieStore = await cookies();
        supabase = createServerClient(url, anon, {
            cookies: {get: (n: string) => cookieStore.get(n)?.value},
        });
        const {data: {user: userData}} = await supabase.auth.getUser();
        if (!userData) {
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        user = userData;
    }

    // Валидация входных данных
    const validationResult = await validateRequest(req, quickHoldSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }
    
    const { biz_id, branch_id, service_id, staff_id, start_at } = validationResult.data;

    let branch: { id: string } | null = null;
    
    // Если branch_id передан, используем его, иначе находим первый активный филиал
    if (branch_id) {
        const {data: branchData, error: eBranch} = await supabase
            .from('branches')
            .select('id')
            .eq('id', branch_id)
            .eq('biz_id', biz_id)
            .eq('is_active', true)
            .maybeSingle<{ id: string }>();
        
        if (eBranch) {
            logError('QuickHold', 'Branch lookup error', eBranch);
            return createErrorResponse('validation', eBranch.message, undefined, 400);
        }
        branch = branchData;
    } else {
        // Fallback: находим первый активный филиал
        const {data: branchData, error: eBranch} = await supabase
            .from('branches')
            .select('id')
            .eq('biz_id', biz_id)
            .eq('is_active', true)
            .order('created_at', {ascending: true})
            .limit(1)
            .maybeSingle<{ id: string }>();
        
        if (eBranch) {
            logError('QuickHold', 'Branch lookup error', eBranch);
            return createErrorResponse('validation', eBranch.message, undefined, 400);
        }
        branch = branchData;
    }

    if (!branch?.id) {
        return createErrorResponse('not_found', 'No active branch', undefined, 400);
    }

    function pickBookingId(data: unknown): string | null {
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object') {
            const rec = data as Record<string, unknown>;
            if (typeof rec.booking_id === 'string') return rec.booking_id;
            if (typeof rec.id === 'string') return rec.id;
        }
        return null;
    }

    // Вызываем RPC с правильным контекстом авторизации
    // Функция hold_slot использует auth.uid() для получения client_id
    // Поэтому важно, чтобы токен был правильно передан в заголовках
    logDebug('QuickHold', 'Calling hold_slot RPC', { userId: user.id });
    const { data: rpcData, error } = await supabase.rpc<string, HoldSlotArgs>('hold_slot', {
        p_biz_id: biz_id,
        p_branch_id: branch.id,
        p_service_id: service_id,
        p_staff_id: staff_id,
        p_start: start_at,
    });
    
    if (error) {
        logError('QuickHold', 'RPC error', error);
    } else {
        logDebug('QuickHold', 'RPC success', { bookingId: pickBookingId(rpcData) });
    }

    if (error) {
        return createErrorResponse('validation', error.message, undefined, 400);
    }

    const bookingId = pickBookingId(rpcData);
    if (!bookingId) {
        return createErrorResponse('validation', 'Unexpected RPC result shape', undefined, 400);
    }

    logDebug('QuickHold', 'Booking created', { bookingId });
    logDebug('QuickHold', 'Attempting to confirm booking');

    // Автоматически подтверждаем бронирование
    const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_booking', {
        p_booking_id: bookingId,
    });
    
    if (confirmError) {
        logError('QuickHold', 'Failed to confirm booking', {
            error: confirmError.message,
            code: confirmError.code,
            details: confirmError.details,
            hint: confirmError.hint,
        });
        return createErrorResponse('validation', confirmError.message, undefined, 400);
    }
    
    logDebug('QuickHold', 'Booking confirmed successfully', { bookingId, confirmData });
    
    // Проверяем статус бронирования после подтверждения
    const { data: bookingCheck, error: checkError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('id', bookingId)
        .single();
    
    if (checkError) {
        logError('QuickHold', 'Failed to check booking status', checkError);
    } else {
        logDebug('QuickHold', 'Booking status after confirm', { status: bookingCheck?.status });
    }

    // Отправляем уведомление о подтверждении
    try {
        await notifyHold(bookingId, req, 'confirm');
        logDebug('QuickHold', 'Notification sent successfully');
    } catch (err) {
        logError('QuickHold', 'notifyHold failed', err);
        // Не возвращаем ошибку, так как бронирование уже создано и подтверждено
    }

            return NextResponse.json({
                ok: true, 
                booking_id: bookingId,
                confirmed: true,
            });
        }
    );
}

async function notifyHold(bookingId: string, req: Request, type: 'hold' | 'confirm' = 'hold') {
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


