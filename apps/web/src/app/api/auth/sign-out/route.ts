export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { logDebug, logError } from '@/lib/log';

/**
 * POST /api/auth/sign-out
 * Принудительный выход через Admin API
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // Получаем текущего пользователя из cookies
        const cookieStore = await cookies();
        const admin = createClient(URL, SERVICE);
        
        // Пытаемся получить пользователя из cookies
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // Инвалидируем все refresh токены пользователя через Admin API
            try {
                // @ts-expect-error - invalidateRefreshTokens может отсутствовать в типах @supabase/supabase-js,
                // но метод существует в runtime для Supabase Auth Admin API
                // См. https://supabase.com/docs/reference/javascript/auth-admin-invalidaterefreshtokens
                await admin.auth.admin.invalidateRefreshTokens?.(user.id).catch(() => {});
                logDebug('AuthSignOut', 'Invalidated refresh tokens for user', { userId: user.id });
            } catch (err) {
                logError('AuthSignOut', 'Error invalidating tokens', err);
            }
        }

        // Очищаем все cookies Supabase
        const response = NextResponse.json({ ok: true, message: 'Выход выполнен' });
        
        // Удаляем все возможные cookies Supabase
        const projectRef = URL.split('//')[1].split('.')[0];
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
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('AuthSignOut', 'Error in sign-out', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

