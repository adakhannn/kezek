import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { getLocalAuthPublicOrigin } from '@/lib/localAuthPublicOrigin';
import { routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { createWebLogin, readWebLogin, transitionWebLogin, WEB_LOGIN_TOKEN, webLoginSecret } from '@/lib/telegramWebLoginService';

export const WEB_LOGIN_COOKIE = '__Host-kezek-telegram-login';
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

export async function runTelegramWebLoginHttp(req: NextRequest): Promise<Response> {
    if (process.env.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED !== 'true') return fail('Вход через бота ещё не включён.', 503);
    const origin = getLocalAuthPublicOrigin(req.url);
    if (!origin.startsWith('https://') || req.headers.get('origin') !== origin) return fail('Недопустимый источник запроса.', 403);
    const body = await req.json().catch(() => null);
    if (!body || !['create', 'status', 'cancel', 'finish'].includes(body.action)) return fail('Некорректный запрос.');
    const browser = req.cookies.get(WEB_LOGIN_COOKIE)?.value;
    if (body.action !== 'create' && (!WEB_LOGIN_TOKEN.test(body.token || '') || !browser || !WEB_LOGIN_TOKEN.test(browser))) return fail('Начните вход заново в этом браузере.', 401);
    const limit = routeRateLimit(`telegram-web-login/${body.action}`, {
        maxRequests: body.action === 'status' ? 40 : body.action === 'create' ? 5 : 10,
        windowMs: body.action === 'create' ? 15 * 60_000 : 60_000,
    });
    return withRateLimit(req, limit, async () => {
        try {
            if (body.action === 'create' || body.action === 'finish') {
                const auth = await createSupabaseServerClient();
                const { data: { user } } = await auth.auth.getUser();
                if (user) return fail('Вы уже вошли в Kezek. Для смены аккаунта сначала выйдите.', 409);
            }
            if (body.action === 'create') {
                const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || '';
                if (!/^[A-Za-z0-9_]+$/.test(bot) || !process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) return fail('Вход через бота не настроен.', 503);
                const secret = webLoginSecret();
                const attempt = await createWebLogin(secret, bot);
                const response = reply({ ok: true, data: attempt });
                response.cookies.set(WEB_LOGIN_COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 });
                return response;
            }
            if (body.action === 'status') {
                const data = await readWebLogin(body.token, browser!);
                return data ? reply({ ok: true, data }) : fail('Этот запрос недоступен в данном браузере. Начните заново.', 404);
            }
            if (body.action === 'finish' && (!Number.isSafeInteger(body.telegramId) || body.telegramId <= 0)) return fail('Сначала подтвердите аккаунт.');
            const result = await transitionWebLogin(body.token, body.action, browser, body.telegramId);
            if (result.error) return fail(result.error === 'not_linked'
                ? 'Этот Telegram ещё не подключён к профилю Kezek. Войдите другим способом и подключите Telegram в личном кабинете.'
                : 'Запрос истёк, отменён или уже использован. Начните вход заново.', 409);
            if (body.action === 'cancel') return reply({ ok: true, data: { status: 'cancelled' } });
            if (!result.user_id) return fail('Не удалось определить профиль.', 409);
            // The database has atomically consumed this attempt. A failure below
            // requires a fresh attempt: never replay a session or reset passwords.
            const admin = getServiceClient();
            const { data: target, error: targetError } = await admin.auth.admin.getUserById(result.user_id);
            if (targetError || !target.user?.email) return fail('Вход недоступен для этого профиля. Войдите другим способом.', 409);
            const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: target.user.email });
            if (linkError || link.user?.id !== result.user_id || !link.properties?.hashed_token) throw new Error('Session preparation failed');
            const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
            const session = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
                cookies: { getAll: () => req.cookies.getAll(), setAll: (cookies: typeof pendingCookies) => { pendingCookies.push(...cookies); } },
            });
            // generateLink returns a token, it does not send an email.
            const { data: verified, error: verifyError } = await session.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
            if (verifyError || !verified.session || verified.user?.id !== result.user_id) throw new Error('Session verification failed');
            const response = reply({ ok: true, data: { status: 'signed_in' } });
            for (const cookie of pendingCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
            response.cookies.set(WEB_LOGIN_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0 });
            return response;
        } catch {
            return fail('Не удалось завершить вход. Создайте новый запрос или войдите другим способом.', 503);
        }
    });
}
