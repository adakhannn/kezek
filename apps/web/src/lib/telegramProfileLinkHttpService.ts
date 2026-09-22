import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getLocalAuthPublicOrigin } from '@/lib/localAuthPublicOrigin';
import { routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { createProfileLink, PROFILE_LINK_TOKEN, profileLinkErrorMessage, readProfileLink, transitionProfileLink } from '@/lib/telegramProfileLinkService';

export async function runTelegramProfileLinkHttp(req: Request): Promise<Response> {
    if (process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED !== 'true') {
        return createErrorResponse('service_unavailable', 'Подключение через бота ещё не включено', undefined, 503);
    }
    if (req.headers.get('origin') !== getLocalAuthPublicOrigin(req.url)) {
        return createErrorResponse('forbidden', 'Недопустимый источник запроса', undefined, 403);
    }
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return createErrorResponse('auth', 'Войдите в Kezek заново', undefined, 401);
    const body = await req.json().catch(() => null);
    if (!body || !['create', 'status', 'cancel', 'finish'].includes(body.action)) {
        return createErrorResponse('validation', 'Некорректный запрос', undefined, 400);
    }
    if (body.action !== 'create' && (typeof body.token !== 'string' || !PROFILE_LINK_TOKEN.test(body.token))) {
        return createErrorResponse('validation', 'Некорректная ссылка', undefined, 400);
    }
    if (body.action === 'finish' && (!Number.isSafeInteger(body.telegramId) || body.telegramId <= 0)) {
        return createErrorResponse('validation', 'Выберите аккаунт Telegram', undefined, 400);
    }
    // Independent polling allowance; checking status never consumes the creation quota.
    const config = routeRateLimit(`telegram-profile-link/${body.action}`, {
        maxRequests: body.action === 'status' ? 40 : body.action === 'create' ? 5 : 15,
        windowMs: body.action === 'create' ? 15 * 60_000 : 60_000,
        identifier: `user:${user.id}`,
    });
    return withRateLimit(req, config, async () => {
        if (body.action === 'create') {
            const username = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
            if (!process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || !/^[A-Za-z0-9_]+$/.test(username)) {
                return createErrorResponse('service_unavailable', 'Подключение через бота ещё не настроено', undefined, 503);
            }
            return createSuccessResponse(await createProfileLink(user.id, username));
        }
        if (body.action === 'status') {
            const result = await readProfileLink(user.id, body.token);
            return result ? createSuccessResponse(result) : createErrorResponse('not_found', profileLinkErrorMessage('not_found'), undefined, 404);
        }
        const result = await transitionProfileLink({
            token: body.token, ownerId: user.id, action: body.action === 'cancel' ? 'cancel_owner' : 'finish',
            telegramId: body.action === 'finish' ? body.telegramId : undefined,
        });
        if (body.action === 'cancel' && ['expired', 'closed', 'not_found'].includes(result.error || '')) {
            return createSuccessResponse({ status: 'cancelled' });
        }
        if (result.error) return createErrorResponse(result.error, profileLinkErrorMessage(result.error), undefined, result.error === 'expired' ? 410 : 409);
        return createSuccessResponse(result);
    });
}
