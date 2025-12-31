// apps/web/src/app/api/auth/whatsapp/verify-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { normalizePhoneToE164 } from '@/lib/senders/sms';

/**
 * POST /api/auth/whatsapp/verify-otp
 * Проверяет OTP код и создает/входит пользователя
 * Не требует авторизации
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        
        // Получаем redirect из body (передается клиентом)
        const body = await req.json();
        const { phone, code, redirect: redirectParam } = body as { phone?: string; code?: string; redirect?: string };
        const redirect = redirectParam || '/';

        // body уже получен выше

        if (!phone || !code) {
            return NextResponse.json(
                { ok: false, error: 'missing_data', message: 'Номер телефона и код обязательны' },
                { status: 400 }
            );
        }

        if (!/^\d{6}$/.test(code)) {
            return NextResponse.json(
                { ok: false, error: 'invalid_code', message: 'Неверный формат кода. Введите 6 цифр.' },
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

        const admin = createClient(URL, SERVICE);

        // Проверяем OTP код в базе данных
        const { data: otpRecord, error: otpError } = await admin
            .from('whatsapp_otp_codes')
            .select('*')
            .eq('phone', phoneE164)
            .eq('code', code)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (otpError && !otpError.message.includes('does not exist')) {
            console.error('[auth/whatsapp/verify-otp] OTP lookup error:', otpError);
        }

        // Если таблица не существует или запись не найдена, проверяем user_metadata
        let isValidOtp = false;
        if (otpRecord) {
            isValidOtp = true;
            // Помечаем код как использованный
            await admin
                .from('whatsapp_otp_codes')
                .update({ used_at: new Date().toISOString() })
                .eq('id', otpRecord.id);
        } else {
            // Fallback: проверяем user_metadata существующих пользователей
            const { data: users } = await admin.auth.admin.listUsers();
            const user = users?.users.find(
                (u) => u.phone === phoneE164 || (u.user_metadata as { phone?: string })?.phone === phoneE164
            );

            if (user) {
                const userMeta = (user.user_metadata || {}) as {
                    whatsapp_auth_otp?: string;
                    whatsapp_auth_otp_expires?: string;
                };

                const savedCode = userMeta.whatsapp_auth_otp;
                const expiresAt = userMeta.whatsapp_auth_otp_expires;

                if (savedCode === code && expiresAt && new Date(expiresAt) > new Date()) {
                    isValidOtp = true;
                    // Очищаем OTP из metadata
                    await admin.auth.admin.updateUserById(user.id, {
                        user_metadata: {
                            ...userMeta,
                            whatsapp_auth_otp: null,
                            whatsapp_auth_otp_expires: null,
                        },
                    });
                }
            }
        }

        if (!isValidOtp) {
            return NextResponse.json(
                { ok: false, error: 'invalid_code', message: 'Неверный или истекший код. Запросите новый код.' },
                { status: 400 }
            );
        }

        // OTP код верный - создаем или находим пользователя
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        let user = existingUsers?.users.find(
            (u) => u.phone === phoneE164 || (u.user_metadata as { phone?: string })?.phone === phoneE164
        );

        if (!user) {
            // Создаем нового пользователя
            const { data: newUser, error: createError } = await admin.auth.admin.createUser({
                phone: phoneE164,
                phone_confirm: true,
                user_metadata: {
                    phone: phoneE164,
                },
            });

            if (createError) {
                console.error('[auth/whatsapp/verify-otp] Create user error:', createError);
                return NextResponse.json(
                    { ok: false, error: 'create_failed', message: createError.message },
                    { status: 500 }
                );
            }

            user = newUser.user;
            console.log('[auth/whatsapp/verify-otp] New user created:', user.id);

            // Создаем профиль
            await admin
                .from('profiles')
                .upsert({
                    id: user.id,
                    phone: phoneE164,
                    whatsapp_verified: true,
                }, {
                    onConflict: 'id',
                });
        } else {
            // Обновляем профиль существующего пользователя
            await admin
                .from('profiles')
                .upsert({
                    id: user.id,
                    phone: phoneE164,
                    whatsapp_verified: true,
                }, {
                    onConflict: 'id',
                });
        }

        // После проверки OTP создаем сессию через admin API
        // Используем generateLink для создания magic link (но он работает только с email)
        // Для phone auth используем другой подход - создаем временный токен
        
        // Альтернативный подход: используем admin API для создания сессии
        // Но для phone auth нужно использовать стандартный метод
        
        // Упрощенный подход: после проверки OTP через WhatsApp
        // клиент должен использовать стандартный Supabase phone auth для создания сессии
        // Но так как OTP уже проверен, можно использовать прямой вход
        
        // Возвращаем информацию о пользователе
        // Клиент должен будет использовать стандартный Supabase phone auth для создания сессии
        // Но так как OTP уже проверен через WhatsApp, можно использовать прямой вход
        
        return NextResponse.json({
            ok: true,
            message: 'Успешная аутентификация. Используйте стандартный вход через телефон для создания сессии.',
            userId: user.id,
            phone: phoneE164,
            isNewUser: !existingUsers?.users.find((u) => u.id === user?.id),
            // Для создания сессии клиент должен использовать стандартный Supabase phone auth
            // Но так как OTP уже проверен через WhatsApp, можно использовать прямой вход
            // Или клиент может перейти на страницу входа и использовать стандартный метод
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[auth/whatsapp/verify-otp] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

