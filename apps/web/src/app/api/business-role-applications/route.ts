export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    notifyOwnerApplicationSubmitted,
    notifyStaffApplicationSubmitted,
} from '@/lib/businessRoleApplicationNotificationService';
import { submitBusinessRoleApplication } from '@/lib/businessRoleApplicationService';
import { logError } from '@/lib/log';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: false, message: 'auth' }, { status: 401 });

    const requestedRole = new URL(request.url).searchParams.get('requested_role');
    if (requestedRole !== 'owner' && requestedRole !== 'staff') {
        return Response.json({ ok: false, message: 'Некорректный тип заявки.' }, { status: 400 });
    }

    try {
        const { data, error } = await createSupabaseAdminClient()
            .from('business_role_applications')
            .select('id,biz_id,requested_role,status,created_at,businesses(name,slug)')
            .eq('applicant_user_id', user.id)
            .eq('requested_role', requestedRole)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return Response.json({ ok: false, message: error.message }, { status: 400 });
        return Response.json({ ok: true, items: data ?? [] });
    } catch {
        return Response.json({
            ok: false,
            message: 'Сервис заявок не настроен в этом окружении.',
        }, { status: 503 });
    }
}

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return Response.json({
            ok: false,
            code: 'auth_required',
            message: 'Войдите в аккаунт, чтобы подать заявку на роль.',
        }, { status: 401 });
    }

    return withRateLimit(
        request,
        routeRateLimit('business-role-applications', RateLimitConfigs.normal, {
            maxRequests: 10,
            windowMs: 60 * 60 * 1000,
            identifier: `user:${user.id}`,
        }),
        async () => {
            let input: { biz_id?: unknown; requested_role?: unknown; message?: unknown; evidence_links?: unknown };
            try {
                input = await request.json();
            } catch {
                return Response.json({ ok: false, message: 'Неверный формат запроса.' }, { status: 400 });
            }

            let result;
            try {
                result = await submitBusinessRoleApplication({
                    admin: createSupabaseAdminClient(),
                    user,
                    input,
                });
            } catch (error) {
                return Response.json({
                    ok: false,
                    code: 'service_unavailable',
                    message: error instanceof Error
                        ? error.message
                        : 'Сервис заявок временно недоступен.',
                }, { status: 503 });
            }

            if (!result.ok) {
                return Response.json(
                    { ok: false, code: result.code, message: result.message },
                    { status: result.status },
                );
            }

            if (input.requested_role === 'staff' || input.requested_role === 'owner') {
                try {
                    const notificationInput = {
                        id: result.id,
                        businessId: typeof input.biz_id === 'string' ? input.biz_id : '',
                        origin: new URL(request.url).origin,
                        applicant: {
                            id: user.id,
                            name: result.applicant.name,
                            email: result.applicant.email,
                        },
                    };
                    if (input.requested_role === 'staff') {
                        await notifyStaffApplicationSubmitted(createSupabaseAdminClient(), notificationInput);
                    } else {
                        await notifyOwnerApplicationSubmitted(createSupabaseAdminClient(), notificationInput);
                    }
                } catch (error) {
                    logError('BusinessRoleApplicationNotification', 'Notification workflow failed', error);
                }
            }

            return Response.json({ ok: true, id: result.id });
        },
    );
}
