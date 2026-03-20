import { extractBookingId, type CreateGuestBookingParams } from '@core-domain/booking';
import { createClient } from "@supabase/supabase-js";

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickBookGuestSchema } from '@/lib/validation/bookingSchemas';

type HoldSlotGuestArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_service_id: string;
    p_staff_id: string;
    p_start: string;
    p_client_name: string;
    p_client_phone: string;
    p_client_email?: string | null;
};

type HoldComplexSlotGuestArgs = {
    p_biz_id: string;
    p_branch_id: string;
    p_staff_id: string;
    p_start: string;
    p_services: { service_id: string; duration_min: number; order_index?: number }[];
    p_client_name: string;
    p_client_phone: string;
    p_client_email?: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    // Применяем rate limiting для публичного endpoint
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        async () => {
            return withErrorHandler('QuickBookGuest', async () => {
            const url = getSupabaseUrl();
            const anon = getSupabaseAnonKey();
            
            // Для гостевых броней используем анонимный клиент (без авторизации)
            const supabase = createClient(url, anon, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            const validationResult = await validateRequest(req, quickBookGuestSchema);
            if (!validationResult.success) {
                return validationResult.response;
            }

            const raw = validationResult.data as {
                biz_id: string;
                branch_id: string;
                service_id?: string;
                services?: { service_id: string; duration_min: number; order_index?: number }[];
                staff_id: string;
                start_at: string;
                client_name: string;
                client_phone: string;
                client_email?: string | null;
            };
            const forDomain = {
                ...raw,
                service_id: raw.service_id ?? (raw.services?.[0] ? raw.services[0].service_id : undefined),
            };
            const body = forDomain as CreateGuestBookingParams & {
                services?: { service_id: string; duration_min: number; order_index?: number }[];
            };
            const domainValidation = { valid: true, data: body, error: null as string | null };
            if (!domainValidation.valid || !domainValidation.data) {
                return createErrorResponse('validation', domainValidation.error || 'Неверные параметры гостевой брони', undefined, 400);
            }


            // Проверяем, что переданный филиал существует и активен
            const { data: branch, error: eBranch } = await supabase
                .from('branches')
                .select('id')
                .eq('id', body.branch_id)
                .eq('biz_id', body.biz_id)
                .eq('is_active', true)
                .maybeSingle<{ id: string }>();

            if (eBranch || !branch?.id) {
                return createErrorResponse('not_found', 'Филиал не найден или неактивен', { code: 'no_branch' }, 400);
            }

            const useComplex = body.services && body.services.length > 1;
            let rpcData: string | null = null;
            let error: { message: string } | null = null;

            if (useComplex) {
                logDebug('QuickBookGuest', 'Calling hold_complex_slot_guest RPC', { servicesCount: body.services!.length });
                const result = await supabase.rpc<string, HoldComplexSlotGuestArgs>('hold_complex_slot_guest', {
                    p_biz_id: body.biz_id,
                    p_branch_id: branch.id,
                    p_staff_id: body.staff_id,
                    p_start: body.start_at,
                    p_services: body.services!,
                    p_client_name: body.client_name,
                    p_client_phone: body.client_phone,
                    p_client_email: body.client_email,
                });
                rpcData = result.data;
                error = result.error;
            } else {
                logDebug('QuickBookGuest', 'Calling hold_slot_guest RPC');
                const result = await supabase.rpc<string, HoldSlotGuestArgs>('hold_slot_guest', {
                    p_biz_id: body.biz_id,
                    p_branch_id: branch.id,
                    p_service_id: body.service_id,
                    p_staff_id: body.staff_id,
                    p_start: body.start_at,
                    p_client_name: body.client_name,
                    p_client_phone: body.client_phone,
                    p_client_email: body.client_email,
                });
                rpcData = result.data;
                error = result.error;
            }

            if (error) {
                logError('QuickBookGuest', 'RPC error', error);
                return createErrorResponse('validation', error.message, { code: 'rpc' }, 400);
            }

            // Используем доменную функцию для извлечения booking_id
            const bookingId = extractBookingId(rpcData);
            if (!bookingId) {
                logError('QuickBookGuest', 'Unexpected RPC result shape', { rpcData });
                return createErrorResponse('validation', 'Неожиданный формат результата RPC', { code: 'rpc_shape' }, 400);
            }

            logDebug('QuickBookGuest', 'Guest booking created', { bookingId });
            
            // Подтверждаем бронирование (пока миграции не применены, функция создает hold)
            const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_booking', {
                p_booking_id: bookingId,
            });
            
            if (confirmError) {
                logError('QuickBookGuest', 'Failed to confirm booking', {
                    error: confirmError.message,
                    code: confirmError.code,
                    details: confirmError.details,
                    hint: confirmError.hint,
                });
                // Не возвращаем ошибку, так как бронирование уже создано
            } else {
                logDebug('QuickBookGuest', 'Booking confirmed successfully', { bookingId, confirmData });
            }

            // Отправляем уведомление о подтверждении
            try {
                await notifyGuestBooking(bookingId, req, 'confirm');
                logDebug('QuickBookGuest', 'Notification sent successfully');
            } catch (err) {
                logError('QuickBookGuest', 'notifyGuestBooking failed', err);
                // Не возвращаем ошибку, так как бронирование уже создано и подтверждено
            }

            return createSuccessResponse({
                booking_id: bookingId,
                confirmed: true,
            });
            });
        }
    );
}

async function notifyGuestBooking(bookingId: string, req: Request, type: 'hold' | 'confirm' = 'hold') {
    try {
        const notifyUrl = new URL('/api/notify', req.url);
        logDebug('QuickBookGuest', 'Calling notify API', { url: notifyUrl.toString(), type, bookingId });
        
        const response = await fetch(notifyUrl, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({type, booking_id: bookingId}),
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError('QuickBookGuest', 'Notify API error', { status: response.status, errorText });
        } else {
            const result = await response.json().catch(() => ({}));
            logDebug('QuickBookGuest', 'Notify API success', result);
        }
    } catch (error) {
        logError('QuickBookGuest', 'Notify API exception', error);
    }
}

