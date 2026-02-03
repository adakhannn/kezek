import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
    p_start: string; // ISO-строка с таймзоной
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
            const url = getSupabaseUrl();
            const anon = getSupabaseAnonKey();
            
            // Для гостевых броней используем анонимный клиент (без авторизации)
            const supabase = createClient(url, anon, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            // Валидация входных данных
            const validationResult = await validateRequest(req, quickBookGuestSchema);
            if (!validationResult.success) {
                return validationResult.response;
            }
            
            const body = validationResult.data;

            // Нормализуем телефон (убираем пробелы, дефисы и т.д.)
            // Телефон уже валидирован как E.164, но убираем возможные пробелы для безопасности
            const normalizedPhone = body.client_phone.replace(/\s+/g, '').replace(/[-\s()]/g, '');

            // Получаем первый активный филиал бизнеса
            const { data: branch, error: eBranch } = await supabase
                .from('branches')
                .select('id')
                .eq('biz_id', body.biz_id)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle<{ id: string }>();

            if (eBranch || !branch?.id) {
                return NextResponse.json(
                    { ok: false, error: 'no_branch', message: 'No active branch found' },
                    { status: 400 }
                );
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

            // Вызываем RPC для создания гостевой брони
            logDebug('QuickBookGuest', 'Calling hold_slot_guest RPC');
            const { data: rpcData, error } = await supabase.rpc<string, HoldSlotGuestArgs>('hold_slot_guest', {
                p_biz_id: body.biz_id,
                p_branch_id: branch.id,
                p_service_id: body.service_id,
                p_staff_id: body.staff_id,
                p_start: body.start_at,
                p_client_name: body.client_name.trim(),
                p_client_phone: normalizedPhone,
                p_client_email: body.client_email?.trim() || null,
            });
            
            if (error) {
                logError('QuickBookGuest', 'RPC error', error);
                return NextResponse.json(
                    { ok: false, error: 'rpc', message: error.message },
                    { status: 400 }
                );
            }

            const bookingId = pickBookingId(rpcData);
            if (!bookingId) {
                return NextResponse.json(
                    { ok: false, error: 'rpc_shape', message: 'Unexpected RPC result shape' },
                    { status: 400 }
                );
            }

            logDebug('QuickBookGuest', 'Guest booking created', { bookingId });
            logDebug('QuickBookGuest', 'Attempting to confirm booking');

            // Автоматически подтверждаем бронирование
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
                return NextResponse.json(
                    { ok: false, error: 'confirm_failed', message: confirmError.message },
                    { status: 400 }
                );
            }
            
            logDebug('QuickBookGuest', 'Booking confirmed successfully', { bookingId, confirmData });
            
            // Проверяем статус бронирования после подтверждения
            const { data: bookingCheck, error: checkError } = await supabase
                .from('bookings')
                .select('id, status')
                .eq('id', bookingId)
                .single();

            if (checkError) {
                logError('QuickBookGuest', 'Failed to check booking status', checkError);
            } else {
                logDebug('QuickBookGuest', 'Booking status after confirm', { status: bookingCheck?.status });
            }

            // Отправляем уведомление о подтверждении
            try {
                await notifyGuestBooking(bookingId, req, 'confirm');
                logDebug('QuickBookGuest', 'Notification sent successfully');
            } catch (err) {
                logError('QuickBookGuest', 'notifyGuestBooking failed', err);
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

