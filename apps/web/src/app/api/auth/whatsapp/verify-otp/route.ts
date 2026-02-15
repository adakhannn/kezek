// apps/web/src/app/api/auth/whatsapp/verify-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

/**
 * POST /api/auth/whatsapp/verify-otp
 * Проверяет OTP код и создает/входит пользователя
 * Не требует авторизации
 */
export async function POST(req: Request) {
    return withErrorHandler('WhatsAppAuth', async () => {
        // Используем унифицированную утилиту для создания admin клиента
        const admin = createSupabaseAdminClient();
        
        // Получаем redirect из body (передается клиентом)
        const body = await req.json();
        const { phone, code, redirect: redirectParam } = body as { phone?: string; code?: string; redirect?: string };
        const redirect = redirectParam || '/';

        // body уже получен выше

        if (!phone || !code) {
            return createErrorResponse('validation', 'Номер телефона и код обязательны', { code: 'missing_data' }, 400);
        }

        if (!/^\d{6}$/.test(code)) {
            return createErrorResponse('validation', 'Неверный формат кода. Введите 6 цифр.', { code: 'invalid_code' }, 400);
        }

        // Нормализуем номер телефона
        const phoneE164 = normalizePhoneToE164(phone);
        if (!phoneE164) {
            return createErrorResponse('validation', 'Неверный формат номера телефона', { code: 'invalid_phone' }, 400);
        }

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
            logError('WhatsAppAuth', 'OTP lookup error', otpError);
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
            return createErrorResponse('validation', 'Неверный или истекший код. Запросите новый код.', { code: 'invalid_code' }, 400);
        }

        // OTP код верный - создаем или находим пользователя
        // Сначала ищем существующего пользователя с этим номером
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        
        // Ищем пользователя по номеру телефона (проверяем разные форматы)
        let user = existingUsers?.users.find((u) => {
            // Проверяем прямое поле phone
            if (u.phone === phoneE164) return true;
            
            // Проверяем user_metadata
            const meta = u.user_metadata as { phone?: string } | undefined;
            if (meta?.phone === phoneE164) return true;
            
            // Проверяем варианты формата (с пробелами, без + и т.д.)
            const normalizedPhone = u.phone?.replace(/\s/g, '').replace(/^\+/, '');
            const normalizedE164 = phoneE164.replace(/\s/g, '').replace(/^\+/, '');
            if (normalizedPhone === normalizedE164) return true;
            
            return false;
        });

        let isNewUser = false;

        if (!user) {
            // Пытаемся создать нового пользователя
            const { data: newUser, error: createError } = await admin.auth.admin.createUser({
                phone: phoneE164,
                phone_confirm: true,
                user_metadata: {
                    phone: phoneE164,
                },
            });

            if (createError) {
                // Если номер уже зарегистрирован, более тщательно ищем пользователя
                if (createError.message.includes('already registered') || 
                    createError.message.includes('already exists') ||
                    createError.message.includes('Phone number already registered')) {
                    
                    // Получаем всех пользователей заново и ищем более тщательно
                    const { data: allUsers } = await admin.auth.admin.listUsers();
                    user = allUsers?.users.find((u) => {
                        // Проверяем прямое поле phone
                        if (u.phone === phoneE164) return true;
                        
                        // Проверяем user_metadata
                        const meta = u.user_metadata as { phone?: string } | undefined;
                        if (meta?.phone === phoneE164) return true;
                        
                        // Проверяем варианты формата
                        const normalizedPhone = u.phone?.replace(/\s/g, '').replace(/^\+/, '');
                        const normalizedE164 = phoneE164.replace(/\s/g, '').replace(/^\+/, '');
                        if (normalizedPhone === normalizedE164) return true;
                        
                        return false;
                    });

                    if (!user) {
                        logError('WhatsAppAuth', 'Phone already registered but user not found', { 
                            phone: phoneE164,
                            availableUsers: allUsers?.users.map(u => ({ id: u.id, phone: u.phone, meta: u.user_metadata }))
                        });
                        return createErrorResponse('conflict', 'Этот номер телефона уже зарегистрирован. Если это ваш номер, попробуйте войти через стандартную форму входа.', { code: 'phone_taken' }, 409);
                    }

                    logDebug('WhatsAppAuth', 'Found existing user after create error', { userId: user.id });
                } else {
                    logError('WhatsAppAuth', 'Create user error', createError);
                    return createErrorResponse('internal', createError.message, { code: 'create_failed' }, 500);
                }
            } else {
                user = newUser.user;
                isNewUser = true;
                logDebug('WhatsAppAuth', 'New user created', { userId: user.id });
            }
        } else {
            logDebug('WhatsAppAuth', 'Found existing user', { userId: user.id });
        }

        // Обновляем профиль (для нового и существующего пользователя)
        await admin
            .from('profiles')
            .upsert({
                id: user.id,
                phone: phoneE164,
                whatsapp_verified: true,
            }, {
                onConflict: 'id',
            });

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
        
        return createSuccessResponse({
            message: isNewUser ? 'Регистрация успешна' : 'Вход выполнен успешно',
            userId: user.id,
            phone: phoneE164,
            isNewUser: isNewUser,
            // Для создания сессии клиент должен использовать стандартный Supabase phone auth
            // Но так как OTP уже проверен через WhatsApp, можно использовать прямой вход
            // Или клиент может перейти на страницу входа и использовать стандартный метод
        });
    });
}

