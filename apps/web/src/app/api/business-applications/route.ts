export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { submitBusinessApplication, type BusinessApplicationInput } from '@/lib/businessApplicationService';
import { notifyBusinessApplicationSubmitted } from '@/lib/businessRoleApplicationNotificationService';
import { logError } from '@/lib/log';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return Response.json(
            { ok: false, message: 'Войдите в аккаунт Kezek перед отправкой заявки.', code: 'auth_required' },
            { status: 401 },
        );
    }
    return withRateLimit(request, routeRateLimit('business-applications', RateLimitConfigs.public, {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        identifier: `user:${user.id}`,
    }), async () => {
        let input: BusinessApplicationInput;
        try {
            input = (await request.json()) as BusinessApplicationInput;
        } catch {
            return Response.json(
                { ok: false, message: 'Неверный формат запроса', code: 'invalid_request' },
                { status: 400 },
            );
        }
        try {
            const admin = createSupabaseAdminClient();
            const result = await submitBusinessApplication({ admin: admin as never, userId: user.id, input });
            if (!result.ok) return Response.json({ ok: false, message: result.message, code: result.code }, { status: result.status });
            try {
                const displayName = typeof input.contact_name === 'string' && input.contact_name.trim()
                    ? input.contact_name.trim()
                    : typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
                        ? user.user_metadata.full_name.trim()
                        : user.email ?? user.phone ?? 'Пользователь Kezek';
                await notifyBusinessApplicationSubmitted(admin, {
                    id: result.id,
                    businessName: typeof input.business_name === 'string' ? input.business_name.trim() : 'Kezek',
                    origin: new URL(request.url).origin,
                    applicant: {
                        id: user.id,
                        name: displayName,
                        email: typeof input.email === 'string' ? input.email.trim() : user.email,
                    },
                });
            } catch (notificationError) {
                logError('ApplicationNotification', 'Business application notification workflow failed', notificationError);
            }
            return Response.json({ ok: true, id: result.id });
        } catch (error) {
            if (
                error instanceof Error
                && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')
            ) {
                return Response.json({
                    ok: false,
                    message: 'Business application submission is temporarily unavailable',
                    code: 'service_unavailable',
                }, { status: 503 });
            }
            return Response.json({
                ok: false,
                message: error instanceof Error ? error.message : 'Не удалось отправить заявку',
                code: 'unexpected_error',
            }, { status: 500 });
        }
    });
}
