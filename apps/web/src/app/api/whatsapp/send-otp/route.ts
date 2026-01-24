// apps/web/src/app/api/whatsapp/send-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createErrorResponse, handleApiError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

/**
 * POST /api/whatsapp/send-otp
 * Отправляет OTP код на WhatsApp номер пользователя для подтверждения
 */
export async function POST(req: Request) {
    // Применяем rate limiting для аутентификации
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        async () => {
            try {
                const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        // Проверка авторизации
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Получаем номер телефона из профиля
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, whatsapp_verified')
            .eq('id', user.id)
            .maybeSingle<{ phone: string | null; whatsapp_verified: boolean | null }>();

        if (profileError) {
            logError('WhatsAppSendOtp', 'Profile error', profileError);
            return createErrorResponse('validation', profileError.message, { code: 'profile_error' }, 400);
        }

        if (!profile?.phone) {
            return createErrorResponse('validation', 'Номер телефона не указан в профиле', { code: 'no_phone' }, 400);
        }

        if (profile.whatsapp_verified) {
            return createErrorResponse('validation', 'WhatsApp номер уже подтвержден', { code: 'already_verified' }, 400);
        }

        // Генерируем 6-значный OTP код
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Сохраняем OTP код в user_metadata (временное хранилище)
        // В продакшене лучше использовать Redis или отдельную таблицу с TTL
        const { error: metaError } = await supabase.auth.updateUser({
            data: {
                whatsapp_otp_code: otpCode,
                whatsapp_otp_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 минут
            },
        });

        if (metaError) {
            logError('WhatsAppSendOtp', 'Metadata error', metaError);
            return createErrorResponse('internal', 'Не удалось сохранить OTP код', { code: 'otp_save_failed' }, 500);
        }

        // Нормализуем номер телефона
        const phoneE164 = normalizePhoneToE164(profile.phone);
        if (!phoneE164) {
            return createErrorResponse('validation', 'Неверный формат номера телефона', { code: 'invalid_phone' }, 400);
        }

        // Отправляем OTP код на WhatsApp
        const message = `Ваш код подтверждения WhatsApp для Kezek: ${otpCode}\n\nКод действителен в течение 10 минут.`;

        try {
            await sendWhatsApp({ to: phoneE164, text: message });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logError('WhatsAppSendOtp', 'Failed to send OTP', e);
            return createErrorResponse('internal', `Не удалось отправить код: ${errorMsg}`, { code: 'send_failed' }, 500);
        }

                return NextResponse.json({ ok: true, message: 'Код отправлен на WhatsApp' });
            } catch (error) {
                return handleApiError(error, 'WhatsAppSendOtp', 'Внутренняя ошибка при отправке OTP');
            }
        }
    );
}

