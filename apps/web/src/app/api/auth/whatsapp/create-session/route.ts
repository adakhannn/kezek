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
        const { phone, userId, redirect: redirectParam } = body as { phone?: string; userId?: string; redirect?: string };
        const finalRedirect = redirectParam || '/';

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
        
        const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(finalRedirect)}`;

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

            // Magic link содержит токены в hash фрагменте, который доступен только на клиенте
            // Поэтому всегда возвращаем magic link для перехода
            // Callback страница обработает токены и создаст сессию
            console.log('[auth/whatsapp/create-session] Returning magic link for redirect');
            return NextResponse.json({
                ok: true,
                magicLink: magicLink,
                needsRedirect: true,
            });
        } else {
            // Если нет email, создаем временный email для генерации magic link
            // Используем формат: phone+whatsapp@kezek.kg (временный email на основе номера телефона)
            const phoneDigits = user.phone?.replace(/[^0-9]/g, '') || user.id.replace(/-/g, '');
            const tempEmail = `${phoneDigits}@whatsapp.kezek.kg`;
            
            console.log('[auth/whatsapp/create-session] Creating temp email for user without email:', { userId: user.id, tempEmail });
            
            // Обновляем пользователя, добавляя временный email
            const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
                email: tempEmail,
                email_confirm: true,
            });
            
            if (updateError) {
                console.error('[auth/whatsapp/create-session] Failed to add temp email:', updateError);
                return NextResponse.json(
                    { ok: false, error: 'update_failed', message: `Не удалось создать сессию: ${updateError.message}` },
                    { status: 500 }
                );
            }
            
            console.log('[auth/whatsapp/create-session] Temp email added, generating magic link...');
            
            // Теперь генерируем magic link с временным email
            const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
                type: 'magiclink',
                email: tempEmail,
                options: {
                    redirectTo,
                },
            });

            if (linkError || !linkData) {
                console.error('[auth/whatsapp/create-session] Link generation error:', linkError);
                return NextResponse.json(
                    { ok: false, error: 'session_failed', message: `Не удалось создать сессию: ${linkError?.message || 'unknown error'}` },
                    { status: 500 }
                );
            }

            const magicLink = linkData.properties?.action_link;
            console.log('[auth/whatsapp/create-session] Magic link generated:', magicLink?.substring(0, 100) + '...');
            
            if (!magicLink) {
                return NextResponse.json(
                    { ok: false, error: 'session_failed', message: 'Не удалось получить ссылку для входа' },
                    { status: 500 }
                );
            }

            // Magic link содержит токены в hash фрагменте, который доступен только на клиенте
            // Поэтому всегда возвращаем magic link для перехода
            // Callback страница обработает токены и создаст сессию
            console.log('[auth/whatsapp/create-session] Returning magic link for redirect (no email case)');
            return NextResponse.json({
                ok: true,
                magicLink: magicLink,
                needsRedirect: true,
            });
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[auth/whatsapp/create-session] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

