import { createClient } from '@supabase/supabase-js';

import type { DbClient } from '@/lib/supabaseTypes';
import type { Database } from '@/types/supabase';

type UserLike = {
    id: string;
};

type MobileAuthSuccess = {
    ok: true;
    client: DbClient;
    user: UserLike;
};

type MobileAuthFailure = {
    ok: false;
    error: 'auth';
    message: string;
    status: 401;
};

export type MobileAuthResult = MobileAuthSuccess | MobileAuthFailure;

export async function resolveMobileBookingAuth({
    authorizationHeader,
    supabaseUrl,
    anonKey,
    createServerClient,
}: {
    authorizationHeader: string | null;
    supabaseUrl: string;
    anonKey: string;
    createServerClient: () => Promise<DbClient>;
}): Promise<MobileAuthResult> {
    const bearerToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.substring(7)
        : null;

    let client: DbClient;

    if (bearerToken) {
        client = createClient<Database>(supabaseUrl, anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    } else {
        client = await createServerClient();
    }

    const {
        data: { user },
        error,
    } = await client.auth.getUser();

    if (error || !user) {
        return {
            ok: false,
            error: 'auth',
            message: 'Not signed in',
            status: 401,
        };
    }

    return {
        ok: true,
        client,
        user,
    };
}
