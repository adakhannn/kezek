// apps/web/src/app/api/whatsapp/send-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

/**
 * POST /api/whatsapp/send-otp
 * Отправляет OTP код на WhatsApp номер пользователя для подтверждения
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        // Проверка авторизации
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth', message: 'Не авторизован' }, { status: 401 });
        }

        // Получаем номер телефона из профиля
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, whatsapp_verified')
            .eq('id', user.id)
            .maybeSingle<{ phone: string | null; whatsapp_verified: boolean | null }>();

        if (profileError) {
            console.error('[whatsapp/send-otp] profile error:', profileError);
            return NextResponse.json(
                { ok: false, error: 'profile_error', message: profileError.message },
                { status: 400 }
            );
        }

        if (!profile?.phone) {
            return NextResponse.json(
                { ok: false, error: 'no_phone', message: 'Номер телефона не указан в профиле' },
                { status: 400 }
            );
        }

        if (profile.whatsapp_verified) {
            return NextResponse.json(
                { ok: false, error: 'already_verified', message: 'WhatsApp номер уже подтвержден' },
                { status: 400 }
            );
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
            console.error('[whatsapp/send-otp] metadata error:', metaError);
            return NextResponse.json(
                { ok: false, error: 'otp_save_failed', message: 'Не удалось сохранить OTP код' },
                { status: 500 }
            );
        }

        // Нормализуем номер телефона
        const phoneE164 = normalizePhoneToE164(profile.phone);
        if (!phoneE164) {
            return NextResponse.json(
                { ok: false, error: 'invalid_phone', message: 'Неверный формат номера телефона' },
                { status: 400 }
            );
        }

        // Отправляем OTP код на WhatsApp
        const message = `Ваш код подтверждения WhatsApp для Kezek: ${otpCode}\n\nКод действителен в течение 10 минут.`;

        try {
            await sendWhatsApp({ to: phoneE164, text: message });
            console.log('[whatsapp/send-otp] OTP sent successfully to:', phoneE164);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error('[whatsapp/send-otp] Failed to send OTP:', errorMsg);
            return NextResponse.json(
                { ok: false, error: 'send_failed', message: `Не удалось отправить код: ${errorMsg}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true, message: 'Код отправлен на WhatsApp' });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[whatsapp/send-otp] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

