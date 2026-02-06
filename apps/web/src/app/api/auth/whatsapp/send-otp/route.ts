// apps/web/src/app/api/auth/whatsapp/send-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { logDebug, logWarn, logError } from '@/lib/log';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

/**
 * POST /api/auth/whatsapp/send-otp
 * Отправляет OTP код на WhatsApp для входа/регистрации
 * Не требует авторизации
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const body = await req.json();
        const { phone } = body as { phone?: string };

        if (!phone) {
            return NextResponse.json(
                { ok: false, error: 'no_phone', message: 'Номер телефона не указан' },
                { status: 400 }
            );
        }

        // Нормализуем номер телефона
        const phoneE164 = normalizePhoneToE164(phone);
        if (!phoneE164) {
            return NextResponse.json(
                { ok: false, error: 'invalid_phone', message: 'Неверный формат номера телефона' },
                { status: 400 }
            );
        }

        // Используем Service Role для проверки существования пользователя и сохранения OTP
        const admin = createClient(URL, SERVICE);

        // Проверяем, существует ли пользователь с таким номером
        const { data: existingUser } = await admin.auth.admin.listUsers();
        const user = existingUser?.users.find(
            (u) => u.phone === phoneE164 || (u.user_metadata as { phone?: string })?.phone === phoneE164
        );

        // Генерируем 6-значный OTP код
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

        // Сохраняем OTP в отдельной таблице или используем временное хранилище
        // Для простоты используем таблицу otp_codes (нужно создать миграцию)
        // Или можно использовать Redis в продакшене
        
        // Временное решение: сохраняем в user_metadata существующего пользователя
        // или создаем временную запись
        if (user) {
            // Пользователь существует - сохраняем OTP в его metadata
            await admin.auth.admin.updateUserById(user.id, {
                user_metadata: {
                    ...(user.user_metadata as object || {}),
                    whatsapp_auth_otp: otpCode,
                    whatsapp_auth_otp_expires: expiresAt.toISOString(),
                },
            });
        } else {
            // Пользователь не существует - создаем временную запись
            // Используем таблицу для хранения OTP (создадим миграцию)
            // Пока используем простой подход через admin API
            // В продакшене лучше использовать Redis или отдельную таблицу
        }

        // Отправляем OTP код на WhatsApp
        const message = `Ваш код входа в Kezek: ${otpCode}\n\nКод действителен в течение 10 минут.\n\nЕсли вы не запрашивали этот код, проигнорируйте это сообщение.`;

        try {
            await sendWhatsApp({ to: phoneE164, text: message });
            logDebug('WhatsAppAuth', 'OTP sent successfully', { phone: phoneE164 });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logError('WhatsAppAuth', 'Failed to send OTP', { error: errorMsg });
            return NextResponse.json(
                { ok: false, error: 'send_failed', message: `Не удалось отправить код: ${errorMsg}` },
                { status: 500 }
            );
        }

        // Сохраняем OTP в базе данных (временное решение)
        // В продакшене лучше использовать Redis с TTL
        const { error: dbError } = await admin
            .from('whatsapp_otp_codes')
            .insert({
                phone: phoneE164,
                code: otpCode,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        // Если таблица не существует, это не критично - используем user_metadata
        if (dbError && !dbError.message.includes('does not exist')) {
            logWarn('WhatsAppAuth', 'Failed to save OTP to DB', { message: dbError.message });
        }

        return NextResponse.json({ 
            ok: true, 
            message: 'Код отправлен на WhatsApp',
            // Не возвращаем код в ответе для безопасности
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('WhatsAppAuth', 'Error in send-otp', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

