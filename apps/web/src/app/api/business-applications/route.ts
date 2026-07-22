export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { submitBusinessApplication, type BusinessApplicationInput } from '@/lib/businessApplicationService';
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
            return Response.json({ ok: false, message: 'Неверный формат запроса' }, { status: 400 });
        }
        try {
            const result = await submitBusinessApplication({ admin: createSupabaseAdminClient() as never, userId: user.id, input });
            if (!result.ok) return Response.json({ ok: false, message: result.message, code: result.code }, { status: result.status });
            return Response.json({ ok: true, id: result.id });
        } catch (error) {
            return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось отправить заявку' }, { status: 500 });
        }
    });
}
