export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { SocialProvider, unlinkSocialIdentity } from '@/lib/socialIdentityUnlinkService';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

const providers = new Set<SocialProvider>(['google', 'yandex', 'telegram', 'whatsapp']);

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return createErrorResponse('auth', 'Не авторизован', undefined, 401);

    let provider: unknown;
    try {
        provider = ((await request.json()) as { provider?: unknown }).provider;
    } catch {
        return createErrorResponse('validation', 'Неверный формат запроса', { code: 'invalid_json' }, 400);
    }
    if (typeof provider !== 'string' || !providers.has(provider as SocialProvider)) {
        return createErrorResponse('validation', 'Неизвестный способ входа', { code: 'invalid_provider' }, 400);
    }

    const result = await unlinkSocialIdentity({
        admin: createSupabaseAdminClient() as never,
        userId: user.id,
        provider: provider as SocialProvider,
    });
    if (!result.ok) return createErrorResponse(result.error, result.message, result.details, result.status);
    return createSuccessResponse(result.data);
}
