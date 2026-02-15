export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseUrl } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

/**
 * POST /api/auth/sign-out
 * Принудительный выход через Admin API
 */
export async function POST(_req: Request) {
    return withErrorHandler('AuthSignOut', async () => {
        // Используем унифицированные утилиты для создания клиентов
        const { supabase, admin } = await createSupabaseClients();

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // Инвалидируем все refresh токены пользователя через Admin API
            try {
                // invalidateRefreshTokens может отсутствовать в типах @supabase/supabase-js,
                // но метод существует в runtime для Supabase Auth Admin API
                // См. https://supabase.com/docs/reference/javascript/auth-admin-invalidaterefreshtokens
                const authAdmin = admin.auth.admin as { invalidateRefreshTokens?: (userId: string) => Promise<unknown> };
                if (authAdmin.invalidateRefreshTokens) {
                    await authAdmin.invalidateRefreshTokens(user.id).catch(() => {});
                    logDebug('AuthSignOut', 'Invalidated refresh tokens for user', { userId: user.id });
                }
            } catch (err) {
                logError('AuthSignOut', 'Error invalidating tokens', err);
            }
        }

        // Очищаем все cookies Supabase
        const response = createSuccessResponse(undefined, { message: 'Выход выполнен' });
        
        // Удаляем все возможные cookies Supabase
        const url = getSupabaseUrl();
        const projectRef = url.split('//')[1].split('.')[0];
        const cookieNames = [
            `sb-${projectRef}-auth-token`,
            `sb-${projectRef}-auth-token-code-verifier`,
        ];

        cookieNames.forEach(name => {
            response.cookies.delete(name);
            response.cookies.set(name, '', { expires: new Date(0), path: '/' });
            response.cookies.set(name, '', { expires: new Date(0), path: '/', domain: undefined });
        });

        return response;
    });
}

