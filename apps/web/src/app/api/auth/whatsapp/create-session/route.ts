// apps/web/src/app/api/auth/whatsapp/create-session/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { normalizePhoneToE164 } from '@/lib/senders/sms';

/**
 * POST /api/auth/whatsapp/create-session
 * Создает сессию для пользователя после проверки OTP через WhatsApp
 * Использует Admin API для генерации access token
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        
        const body = await req.json();
        const { phone, userId } = body as { phone?: string; userId?: string };

        if (!phone && !userId) {
            return NextResponse.json(
                { ok: false, error: 'missing_data', message: 'Номер телефона или ID пользователя обязательны' },
                { status: 400 }
            );
        }

        const admin = createClient(URL, SERVICE);

        // Находим пользователя
        let user;
        if (userId) {
            const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
            if (userError || !userData?.user) {
                return NextResponse.json(
                    { ok: false, error: 'user_not_found', message: 'Пользователь не найден' },
                    { status: 404 }
                );
            }
            user = userData.user;
        } else if (phone) {
            const phoneE164 = normalizePhoneToE164(phone);
            if (!phoneE164) {
                return NextResponse.json(
                    { ok: false, error: 'invalid_phone', message: 'Неверный формат номера телефона' },
                    { status: 400 }
                );
            }

            const { data: users } = await admin.auth.admin.listUsers();
            user = users?.users.find((u) => {
                if (u.phone === phoneE164) return true;
                const meta = u.user_metadata as { phone?: string } | undefined;
                if (meta?.phone === phoneE164) return true;
                return false;
            });

            if (!user) {
                return NextResponse.json(
                    { ok: false, error: 'user_not_found', message: 'Пользователь не найден' },
                    { status: 404 }
                );
            }
        } else {
            return NextResponse.json(
                { ok: false, error: 'missing_data', message: 'Номер телефона или ID пользователя обязательны' },
                { status: 400 }
            );
        }

        // Генерируем magic link для создания сессии
        // Но generateLink работает только с email, поэтому используем другой подход
        // Используем Admin API для создания access token напрямую
        
        // Альтернативный подход: используем signInWithPassword с временным паролем
        // Но это не идеально, так как требует установки пароля
        
        // Лучший подход: используем Admin API для генерации access token
        // Но для этого нужно использовать другой метод
        
        // Временно: используем generateLink с email, если он есть
        // Если email нет, создаем временный email или используем другой метод
        
        const userEmail = user.email;
        const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
        const redirectTo = `${origin}/auth/callback?next=/`;

        if (userEmail) {
            // Если есть email, используем generateLink
            const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
                type: 'magiclink',
                email: userEmail,
                options: {
                    redirectTo,
                },
            });

            if (linkError || !linkData) {
                console.error('[auth/whatsapp/create-session] Link generation error:', linkError);
                return NextResponse.json(
                    { ok: false, error: 'session_failed', message: 'Не удалось создать сессию' },
                    { status: 500 }
                );
            }

            const magicLink = linkData.properties?.action_link;
            if (!magicLink) {
                return NextResponse.json(
                    { ok: false, error: 'session_failed', message: 'Не удалось получить ссылку для входа' },
                    { status: 500 }
                );
            }

            // Извлекаем токены из magic link
            // Magic link может быть в формате URL с hash или query параметрами
            let accessToken: string | null = null;
            let refreshToken: string | null = null;
            
            // Пробуем извлечь из hash (формат: #access_token=...&refresh_token=...)
            const hashMatch = magicLink.match(/#access_token=([^&]+)&refresh_token=([^&]+)/);
            if (hashMatch) {
                accessToken = decodeURIComponent(hashMatch[1]);
                refreshToken = decodeURIComponent(hashMatch[2]);
            } else {
                // Пробуем извлечь из query параметров
                const queryMatch = magicLink.match(/[?&]access_token=([^&]+)/);
                const refreshMatch = magicLink.match(/[?&]refresh_token=([^&]+)/);
                if (queryMatch) accessToken = decodeURIComponent(queryMatch[1]);
                if (refreshMatch) refreshToken = decodeURIComponent(refreshMatch[1]);
            }

            if (!accessToken || !refreshToken) {
                return NextResponse.json(
                    { ok: false, error: 'session_failed', message: 'Не удалось извлечь токены из ссылки' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                ok: true,
                session: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                },
            });
        } else {
            // Если нет email, используем другой подход
            // Создаем временный email или используем signInWithPassword
            // Но лучше всего - использовать Admin API для генерации access token напрямую
            
            // Временно возвращаем ошибку, если нет email
            return NextResponse.json(
                { ok: false, error: 'no_email', message: 'Для создания сессии требуется email. Пожалуйста, добавьте email в профиль.' },
                { status: 400 }
            );
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[auth/whatsapp/create-session] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

