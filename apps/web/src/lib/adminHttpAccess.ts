import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { createErrorResponse } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** Cookie-authenticated global administrator, checked before privileged work. */
export async function requireCurrentSuperAdmin() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) {
            return { ok: false as const, response: createErrorResponse('auth', 'Не авторизован', undefined, 401) };
        }
        const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(supabase, data.user.id);
        if (error) {
            return { ok: false as const, response: createErrorResponse('service_unavailable', 'Не удалось проверить права доступа', undefined, 503) };
        }
        if (!isSuperAdmin) {
            return { ok: false as const, response: createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403) };
        }
        return { ok: true as const, user: data.user, supabase };
    } catch {
        return { ok: false as const, response: createErrorResponse('service_unavailable', 'Не удалось проверить права доступа', undefined, 503) };
    }
}
