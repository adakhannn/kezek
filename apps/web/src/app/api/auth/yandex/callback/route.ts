// apps/web/src/app/api/auth/yandex/callback/route.ts
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

export async function GET(req: Request) {
    return withErrorHandler('YandexAuth', async () => {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const redirectTo = searchParams.get('redirect') || '/';

        const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
        const redirectUri = `${origin}/auth/callback-yandex`;

        if (error) {
            return NextResponse.redirect(
                `${origin}/auth/sign-in?error=${encodeURIComponent(error)}`
            );
        }

        if (!code) {
            return NextResponse.redirect(
                `${origin}/auth/sign-in?error=no_code`
            );
        }

        // Обмениваем code на access_token
        // ВАЖНО: redirect_uri должен точно совпадать с тем, что был указан при запросе авторизации
        const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: process.env.YANDEX_OAUTH_CLIENT_ID!,
                client_secret: process.env.YANDEX_OAUTH_CLIENT_SECRET!,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            logError('YandexAuth', 'Token exchange error', { errorText });
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new Error('No access token received');
        }

        // Получаем информацию о пользователе
        const userResponse = await fetch('https://login.yandex.ru/info', {
            headers: {
                Authorization: `OAuth ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            logError('YandexAuth', 'User info error', { errorText });
            throw new Error('Failed to get user info');
        }

        const yandexUser = await userResponse.json();

        // Создаем/находим пользователя в Supabase
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(SUPABASE_URL, SERVICE);

        // Ищем существующий профиль по yandex_id
        const { data: existingProfile, error: profileSelectError } = await admin
            .from('profiles')
            .select('id, yandex_id')
            .eq('yandex_id', String(yandexUser.id))
            .maybeSingle<{ id: string | null; yandex_id: string | null }>();

        if (profileSelectError) {
            logError('YandexAuth', 'Profile select error', profileSelectError);
        }

        let userId: string;

        if (existingProfile?.id) {
            // Пользователь уже существует – обновляем профиль
            userId = existingProfile.id;

            const { error: profileUpdateError } = await admin
                .from('profiles')
                .update({
                    full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                    yandex_id: String(yandexUser.id),
                    yandex_username: yandexUser.login || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (profileUpdateError) {
                logError('YandexAuth', 'Profile update error', profileUpdateError);
            }
        } else {
            // Новый пользователь – создаём в Supabase Auth и в profiles
            const email = yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`;
            const initialPassword = crypto.randomBytes(32).toString('hex');

            // Пытаемся создать пользователя
            const { data: authData, error: authError } = await admin.auth.admin.createUser({
                email,
                password: initialPassword,
                email_confirm: true,
                user_metadata: {
                    yandex_id: String(yandexUser.id),
                    yandex_username: yandexUser.login,
                    auth_provider: 'yandex',
                },
            });

            if (authError) {
                // Если пользователь уже существует (дубликат email), пытаемся найти его
                if (authError.message?.includes('already registered') || 
                    authError.message?.includes('already exists') ||
                    authError.message?.includes('email address has already been registered')) {
                    logDebug('YandexAuth', 'User already exists, trying to find by email', { email });
                    
                    // Ищем пользователя по email через auth_users_view
                    try {
                        const { data: userByEmail } = await admin
                            .from('auth_users_view')
                            .select('id')
                            .eq('email', email)
                            .maybeSingle();
                        
                        if (userByEmail?.id) {
                            userId = userByEmail.id;
                            logDebug('YandexAuth', 'Found existing user by email in auth_users_view', { userId });
                            
                            // Создаем профиль, если его нет
                            const { data: existingProfile } = await admin
                                .from('profiles')
                                .select('id')
                                .eq('id', userId)
                                .maybeSingle();
                            
                            if (!existingProfile) {
                                await admin.from('profiles').insert({
                                    id: userId,
                                    full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                                    yandex_id: String(yandexUser.id),
                                    yandex_username: yandexUser.login || null,
                                });
                            }
                        } else {
                            // Если не нашли в auth_users_view, пытаемся найти через auth.users
                            // Используем listUsers через admin API
                            const { data: { users } } = await admin.auth.admin.listUsers();
                            const existingUser = users?.find(u => u.email === email);
                            
                            if (existingUser) {
                                userId = existingUser.id;
                                logDebug('YandexAuth', 'Found existing user by email in auth', { userId });
                                
                                // Создаем профиль, если его нет
                                const { data: existingProfile } = await admin
                                    .from('profiles')
                                    .select('id')
                                    .eq('id', userId)
                                    .maybeSingle();
                                
                                if (!existingProfile) {
                                    await admin.from('profiles').insert({
                                        id: userId,
                                        full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                                        yandex_id: String(yandexUser.id),
                                        yandex_username: yandexUser.login || null,
                                    });
                                }
                            } else {
                                // Если не нашли, возвращаем ошибку
                                logError('YandexAuth', 'User exists but not found', authError);
                                return NextResponse.redirect(
                                    `${origin}/auth/sign-in?error=${encodeURIComponent('Пользователь с таким email уже существует. Попробуйте войти через email.')}`
                                );
                            }
                        }
                    } catch (listError) {
                        logError('YandexAuth', 'Error finding user by email', listError);
                        return NextResponse.redirect(
                            `${origin}/auth/sign-in?error=${encodeURIComponent('Пользователь с таким email уже существует. Попробуйте войти через email.')}`
                        );
                    }
                } else {
                    // Другая ошибка
                    logError('YandexAuth', 'Create user error', authError);
                    const errorMessage = authError.message || 'Failed to create user';
                    return NextResponse.redirect(
                        `${origin}/auth/sign-in?error=${encodeURIComponent(`Ошибка создания пользователя: ${errorMessage}`)}`
                    );
                }
            } else if (!authData?.user) {
                logError('YandexAuth', 'Create user returned no user data');
                return NextResponse.redirect(
                    `${origin}/auth/sign-in?error=${encodeURIComponent('Ошибка создания пользователя: нет данных пользователя')}`
                );
            } else {
                userId = authData.user.id;
            }

            // Проверяем, есть ли уже профиль
            const { data: existingProfile } = await admin
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            if (!existingProfile) {
                // Создаем профиль только если его нет
                const { error: profileInsertError } = await admin.from('profiles').insert({
                    id: userId,
                    full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                    yandex_id: String(yandexUser.id),
                    yandex_username: yandexUser.login || null,
                });

                if (profileInsertError) {
                    logError('YandexAuth', 'Profile insert error', profileInsertError);
                    // Продолжаем, даже если профиль не создался - можно обновить позже
                }
            } else {
                // Обновляем существующий профиль
                await admin
                    .from('profiles')
                    .update({
                        full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                        yandex_id: String(yandexUser.id),
                        yandex_username: yandexUser.login || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);
            }
        }

        // Получаем информацию о пользователе из Supabase Auth, чтобы узнать его email
        const { data: currentUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
        if (getUserError) {
            logError('YandexAuth', 'getUserById error', getUserError);
            throw new Error('Failed to get user info');
        }

        const userEmail = currentUser?.user?.email || yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`;

        // Если у пользователя нет email, устанавливаем его
        if (!currentUser?.user?.email && yandexUser.default_email) {
            await admin.auth.admin.updateUserById(userId, {
                email: yandexUser.default_email,
                email_confirm: true,
            });
        }

        // Создаем сессию через временный пароль (более надежный способ)
        const tempPassword = crypto.randomBytes(32).toString('hex');
        
        // Обновляем пароль пользователя
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });

        if (passwordError) {
            logError('YandexAuth', 'Update password error', passwordError);
            throw new Error('Failed to set password for session');
        }

        // Создаем сессию через admin API
        const { data: { session }, error: signInError } = await admin.auth.signInWithPassword({
            email: userEmail,
            password: tempPassword,
        });

        if (signInError || !session) {
            logError('YandexAuth', 'signInWithPassword error', signInError);
            throw new Error('Failed to create session');
        }

        // Редиректим на callback с токенами в hash
        const redirectUrl = new URL('/auth/callback', origin);
        redirectUrl.searchParams.set('next', redirectTo);
        
        // Кодируем токены для безопасной передачи в hash
        const encodedAccessToken = encodeURIComponent(session.access_token);
        const encodedRefreshToken = encodeURIComponent(session.refresh_token);
        redirectUrl.hash = `access_token=${encodedAccessToken}&refresh_token=${encodedRefreshToken}`;
        
        logDebug('YandexAuth', 'Redirecting to callback with tokens', { userId });
        logDebug('YandexAuth', 'Redirect URL', { 
            url: redirectUrl.toString().replace(/access_token=[^&]+/, 'access_token=***').replace(/refresh_token=[^&]+/, 'refresh_token=***') 
        });
        
        return NextResponse.redirect(redirectUrl.toString());
    });
}

