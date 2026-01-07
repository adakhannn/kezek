// apps/web/src/app/api/auth/yandex/callback/route.ts
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
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
            console.error('[yandex/callback] Token exchange error:', errorText);
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
            console.error('[yandex/callback] User info error:', errorText);
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
            console.error('[yandex/callback] profile select error:', profileSelectError);
        }

        let userId: string;

        if (existingProfile?.id) {
            // Пользователь уже существует – обновляем профиль
            userId = existingProfile.id;

            const { error: profileUpdateError } = await admin
                .from('profiles')
                .update({
                    full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                    email: yandexUser.default_email || null,
                    yandex_id: String(yandexUser.id),
                    yandex_username: yandexUser.login || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (profileUpdateError) {
                console.error('[yandex/callback] profile update error:', profileUpdateError);
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
                if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
                    console.log('[yandex/callback] User already exists, trying to find by email');
                    
                    // Ищем пользователя по email через profiles
                    const { data: profileByEmail } = await admin
                        .from('profiles')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();
                    
                    if (profileByEmail?.id) {
                        userId = profileByEmail.id;
                        console.log('[yandex/callback] Found existing user by email in profiles:', userId);
                    } else {
                        // Если не нашли, возвращаем ошибку
                        console.error('[yandex/callback] User exists but not found in profiles:', authError);
                        return NextResponse.redirect(
                            `${origin}/auth/sign-in?error=${encodeURIComponent('Пользователь с таким email уже существует. Попробуйте войти через email.')}`
                        );
                    }
                } else {
                    // Другая ошибка
                    console.error('[yandex/callback] create user error:', authError);
                    const errorMessage = authError.message || 'Failed to create user';
                    return NextResponse.redirect(
                        `${origin}/auth/sign-in?error=${encodeURIComponent(`Ошибка создания пользователя: ${errorMessage}`)}`
                    );
                }
            } else if (!authData?.user) {
                console.error('[yandex/callback] create user returned no user data');
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
                    email: yandexUser.default_email || null,
                    yandex_id: String(yandexUser.id),
                    yandex_username: yandexUser.login || null,
                });

                if (profileInsertError) {
                    console.error('[yandex/callback] profile insert error:', profileInsertError);
                    // Продолжаем, даже если профиль не создался - можно обновить позже
                }
            } else {
                // Обновляем существующий профиль
                await admin
                    .from('profiles')
                    .update({
                        full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
                        email: yandexUser.default_email || null,
                        yandex_id: String(yandexUser.id),
                        yandex_username: yandexUser.login || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);
            }
        }

        // Создаем сессию для пользователя через magic link
        const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`,
        });

        if (sessionError || !sessionData) {
            console.error('[yandex/callback] generate link error:', sessionError);
            // Пробуем альтернативный способ - используем admin API для создания сессии
            const tempPassword = crypto.randomBytes(32).toString('hex');
            
            // Обновляем пароль пользователя
            await admin.auth.admin.updateUserById(userId, {
                password: tempPassword,
            });

            // Создаем сессию через admin API
            const { data: { session }, error: signInError } = await admin.auth.signInWithPassword({
                email: yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`,
                password: tempPassword,
            });

            if (signInError || !session) {
                throw new Error('Failed to create session');
            }

            // Редиректим на callback с токенами в hash
            const redirectUrl = new URL('/auth/callback', origin);
            redirectUrl.searchParams.set('next', redirectTo);
            redirectUrl.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
            return NextResponse.redirect(redirectUrl.toString());
        }

        // Редиректим на callback страницу
        const redirectUrl = new URL('/auth/callback', origin);
        redirectUrl.searchParams.set('next', redirectTo);
        
        // Если есть токены в properties, используем их
        if (sessionData.properties?.hashed_token) {
            redirectUrl.hash = `access_token=${sessionData.properties.hashed_token}&refresh_token=${sessionData.properties.hashed_token}`;
        }

        return NextResponse.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('[yandex/callback] Error:', error);
        const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
        return NextResponse.redirect(
            `${origin}/auth/sign-in?error=${encodeURIComponent(error instanceof Error ? error.message : 'yandex_auth_failed')}`
        );
    }
}

