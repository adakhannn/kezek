export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = {
    full_name?: string | null;
    phone?: string | null;
    notify_email?: boolean;
    notify_sms?: boolean;
    notify_whatsapp?: boolean;
    notify_telegram?: boolean;
};

export async function POST(req: Request) {
    // Применяем rate limiting для обновления профиля
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('ProfileUpdate', async () => {
        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const body = (await req.json()) as Body;
        const full_name = body.full_name?.trim() || null;
        const phone = body.phone?.trim() || null;
        const notify_email = body.notify_email ?? true;
        const notify_sms = body.notify_sms ?? true;
        const notify_whatsapp = body.notify_whatsapp ?? true;
        const notify_telegram = body.notify_telegram ?? true;

        // Получаем текущий профиль, чтобы проверить, изменился ли номер телефона
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('phone, whatsapp_verified')
            .eq('id', user.id)
            .maybeSingle<{ phone: string | null; whatsapp_verified: boolean | null }>();

        // Если номер телефона был удален или изменен, сбрасываем whatsapp_verified
        const phoneChanged = currentProfile?.phone !== phone;
        const whatsapp_verified = phoneChanged || !phone ? false : (currentProfile?.whatsapp_verified ?? false);

        // Берём telegram_id из user_metadata, если он есть
        const meta = (user.user_metadata ?? {}) as { telegram_id?: number | string | null };
        const upsertData: Record<string, unknown> = {
            id: user.id,
            full_name,
            phone,
            notify_email,
            notify_sms,
            notify_whatsapp,
            whatsapp_verified,
            notify_telegram,
        };

        if (meta.telegram_id != null) {
            const tid = typeof meta.telegram_id === 'string' ? Number(meta.telegram_id) : meta.telegram_id;
            if (!Number.isNaN(tid)) {
                upsertData.telegram_id = tid;
                upsertData.telegram_verified = true;
            }
        }

        // Обновляем профиль в таблице profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(upsertData, { onConflict: 'id' });

        if (profileError) {
            logError('ProfileUpdate', 'profile error', profileError);
            return createErrorResponse('validation', profileError.message, undefined, 400);
        }

        // Также обновляем user_metadata для совместимости
        const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const { error: metaError } = await supabase.auth.updateUser({
            data: { ...prevMeta, full_name: full_name || null },
        });

        if (metaError) {
            logError('ProfileUpdate', 'metadata error', metaError);
            // Не критично, продолжаем
        }

        return createSuccessResponse();
        })
    );
}

