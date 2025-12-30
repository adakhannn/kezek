// apps/web/src/app/api/whatsapp/verify-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * POST /api/whatsapp/verify-otp
 * Проверяет OTP код и подтверждает WhatsApp номер
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

        const body = await req.json();
        const { code } = body as { code?: string };

        if (!code || !/^\d{6}$/.test(code)) {
            return NextResponse.json(
                { ok: false, error: 'invalid_code', message: 'Неверный формат кода. Введите 6 цифр.' },
                { status: 400 }
            );
        }

        // Получаем сохраненный OTP код из user_metadata
        const userMeta = (user.user_metadata ?? {}) as {
            whatsapp_otp_code?: string;
            whatsapp_otp_expires?: string;
        };

        const savedCode = userMeta.whatsapp_otp_code;
        const expiresAt = userMeta.whatsapp_otp_expires;

        if (!savedCode) {
            return NextResponse.json(
                { ok: false, error: 'no_code', message: 'Код не найден. Запросите новый код.' },
                { status: 400 }
            );
        }

        // Проверяем срок действия кода
        if (expiresAt && new Date(expiresAt) < new Date()) {
            return NextResponse.json(
                { ok: false, error: 'expired', message: 'Код истек. Запросите новый код.' },
                { status: 400 }
            );
        }

        // Проверяем код
        if (savedCode !== code) {
            return NextResponse.json(
                { ok: false, error: 'wrong_code', message: 'Неверный код. Попробуйте еще раз.' },
                { status: 400 }
            );
        }

        // Код верный - подтверждаем WhatsApp номер
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ whatsapp_verified: true })
            .eq('id', user.id);

        if (updateError) {
            console.error('[whatsapp/verify-otp] update error:', updateError);
            return NextResponse.json(
                { ok: false, error: 'update_failed', message: updateError.message },
                { status: 500 }
            );
        }

        // Удаляем OTP код из user_metadata
        const { error: metaError } = await supabase.auth.updateUser({
            data: {
                whatsapp_otp_code: null,
                whatsapp_otp_expires: null,
            },
        });

        if (metaError) {
            console.error('[whatsapp/verify-otp] metadata cleanup error:', metaError);
            // Не критично, продолжаем
        }

        return NextResponse.json({ ok: true, message: 'WhatsApp номер подтвержден' });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[whatsapp/verify-otp] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

