// apps/web/src/app/api/whatsapp/verify-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { createErrorResponse, handleApiError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

/**
 * POST /api/whatsapp/verify-otp
 * Проверяет OTP код и подтверждает WhatsApp номер
 */
export async function POST(req: Request) {
    // Применяем rate limiting для аутентификации
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        async () => {
            try {
                // Используем унифицированную утилиту для создания Supabase клиента
                const supabase = await createSupabaseServerClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const body = await req.json();
        const { code } = body as { code?: string };

        if (!code || !/^\d{6}$/.test(code)) {
            return createErrorResponse('validation', 'Неверный формат кода. Введите 6 цифр.', { code: 'invalid_code' }, 400);
        }

        // Получаем сохраненный OTP код из user_metadata
        const userMeta = (user.user_metadata ?? {}) as {
            whatsapp_otp_code?: string;
            whatsapp_otp_expires?: string;
        };

        const savedCode = userMeta.whatsapp_otp_code;
        const expiresAt = userMeta.whatsapp_otp_expires;

        if (!savedCode) {
            return createErrorResponse('validation', 'Код не найден. Запросите новый код.', { code: 'no_code' }, 400);
        }

        // Проверяем срок действия кода
        if (expiresAt && new Date(expiresAt) < new Date()) {
            return createErrorResponse('validation', 'Код истек. Запросите новый код.', { code: 'expired' }, 400);
        }

        // Проверяем код
        if (savedCode !== code) {
            return createErrorResponse('validation', 'Неверный код. Попробуйте еще раз.', { code: 'wrong_code' }, 400);
        }

        // Код верный - подтверждаем WhatsApp номер
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ whatsapp_verified: true })
            .eq('id', user.id);

        if (updateError) {
            logError('WhatsAppVerifyOtp', 'Update profile error', updateError);
            return createErrorResponse('internal', updateError.message, { code: 'update_failed' }, 500);
        }

        // Удаляем OTP код из user_metadata
        const { error: metaError } = await supabase.auth.updateUser({
            data: {
                whatsapp_otp_code: null,
                whatsapp_otp_expires: null,
            },
        });

        if (metaError) {
            logError('WhatsAppVerifyOtp', 'Metadata cleanup error', metaError);
            // Не критично, продолжаем
        }

            return NextResponse.json({ ok: true, message: 'WhatsApp номер подтвержден' });
        } catch (error) {
            return handleApiError(error, 'WhatsAppVerifyOtp', 'Внутренняя ошибка при проверке OTP');
        }
        }
    );
}

