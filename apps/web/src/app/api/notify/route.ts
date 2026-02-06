// apps/web/src/app/api/notify/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { 
    getResendApiKey, 
    getEmailFrom, 
    getSupabaseUrl, 
    getSupabaseAnonKey, 
    getSupabaseServiceRoleKey 
} from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import type { NotifyRequest, BookingRow } from '@/lib/notifications/types';

/**
 * API endpoint для отправки уведомлений о бронированиях
 * 
 * Поддерживает отправку уведомлений через:
 * - Email (Resend)
 * - WhatsApp
 * - Telegram
 * 
 * Получатели:
 * - Клиент (если включены уведомления)
 * - Мастер
 * - Владелец бизнеса
 * - Администраторы из списка email_notify_to
 */
type NotifySuccessResponse = { ok: true; sent: number; whatsappSent: number; telegramSent: number };

export async function POST(req: Request) {
    return withErrorHandler<NotifySuccessResponse>('Notify', async () => {
        logDebug('Notify', 'Endpoint called', {
            url: req.url,
            method: req.method,
        });

        // Валидация запроса
        const body: NotifyRequest = await req.json();
        if (!body?.type || !body?.booking_id) {
            return createErrorResponse('validation', 'Missing type or booking_id', undefined, 400);
        }

        logDebug('Notify', 'Received notification request', {
            type: body.type,
            booking_id: body.booking_id,
        });

        // Получаем конфигурацию
        let apiKey: string;
        try {
            apiKey = getResendApiKey();
        } catch (error) {
            logError('Notify', 'RESEND_API_KEY is not set', error);
            return createErrorResponse('internal', 'RESEND_API_KEY is not set', undefined, 500);
        }

        const from = getEmailFrom();
        const url = getSupabaseUrl();
        const anon = getSupabaseAnonKey();
        const service = getSupabaseServiceRoleKey();

        // Создаем Supabase клиенты
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anon, {
            cookies: { 
                get: (n: string) => cookieStore.get(n)?.value, 
                set: () => {}, 
                remove: () => {} 
            },
        });
        
        // Admin client для получения данных (обход RLS)
        const admin = createClient(url, service);

        // Получаем данные бронирования
        logDebug('Notify', 'Fetching booking data', { booking_id: body.booking_id });
        const { data: booking, error: bookingError } = await admin
            .from('bookings')
            .select(`
                id, status, start_at, end_at, created_at, client_id, client_phone, client_name, client_email,
                services:services!bookings_service_id_fkey ( name_ru, duration_min, price_from, price_to ),
                staff:staff!bookings_staff_id_fkey ( full_name, email, phone, user_id ),
                biz:businesses!bookings_biz_id_fkey ( name, email_notify_to, slug, address, phones, owner_id ),
                branches:branches!bookings_branch_id_fkey ( name, address )
            `)
            .eq('id', body.booking_id)
            .maybeSingle<BookingRow>();

        if (bookingError || !booking) {
            logError('Notify', 'Booking not found or error', {
                booking_id: body.booking_id,
                error: bookingError?.message,
            });
            return NextResponse.json(
                { ok: false, error: bookingError?.message || 'not_found' }, 
                { status: 404 }
            );
        }

        logDebug('Notify', 'Booking found', {
            booking_id: booking.id,
            status: booking.status,
        });

        // Получаем email владельца для reply_to
        const biz = Array.isArray(booking.biz) ? booking.biz[0] : booking.biz;
        let ownerEmail: string | null = null;
        if (biz?.owner_id) {
            try {
                const { data: owner } = await admin.auth.admin.getUserById(biz.owner_id);
                ownerEmail = owner?.user?.email ?? null;
            } catch (e) {
                logError('Notify', 'Failed to get owner email', e);
            }
        }

        // Создаем оркестратор уведомлений
        const orchestrator = new NotificationOrchestrator(
            supabase,
            admin,
            {
                apiKey,
                from,
                replyTo: ownerEmail ?? undefined,
            }
        );

        // Отправляем уведомления
        const result = await orchestrator.sendNotifications(booking, body.type);

        logDebug('Notify', 'Notifications completed', result);

        return NextResponse.json({
            ok: true,
            sent: result.emailsSent,
            whatsappSent: result.whatsappSent,
            telegramSent: result.telegramSent,
        } as { ok: true; sent: number; whatsappSent: number; telegramSent: number });
    });
}
