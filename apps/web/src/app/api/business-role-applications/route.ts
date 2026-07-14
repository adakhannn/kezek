export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { submitBusinessRoleApplication } from '@/lib/businessRoleApplicationService';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(request: Request) {
    return withRateLimit(
        request,
        routeRateLimit('business-role-applications', RateLimitConfigs.normal, {
            maxRequests: 10,
            windowMs: 60 * 60 * 1000,
        }),
        async () => {
            const supabase = await createSupabaseServerClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return Response.json({
                    ok: false,
                    code: 'auth_required',
                    message: 'Войдите в аккаунт, чтобы подать заявку на роль.',
                }, { status: 401 });
            }

            let input: { biz_id?: unknown; requested_role?: unknown; message?: unknown };
            try {
                input = await request.json();
            } catch {
                return Response.json({ ok: false, message: 'Неверный формат запроса.' }, { status: 400 });
            }

            const result = await submitBusinessRoleApplication({
                admin: createSupabaseAdminClient(),
                user,
                input,
            });

            if (!result.ok) {
                return Response.json(
                    { ok: false, code: result.code, message: result.message },
                    { status: result.status },
                );
            }

            return Response.json({ ok: true, id: result.id });
        },
    );
}
