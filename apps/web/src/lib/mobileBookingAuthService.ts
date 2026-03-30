import { createClient } from '@supabase/supabase-js';

type UserLike = {
    id: string;
};

type AuthClientLike = {
    auth: {
        getUser: () => Promise<{
            data: { user: UserLike | null };
            error?: { message?: string } | null;
        }>;
    };
};

type MobileAuthSuccess = {
    ok: true;
    client: AuthClientLike;
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
    createServerClient: () => Promise<AuthClientLike>;
}): Promise<MobileAuthResult> {
    const bearerToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.substring(7)
        : null;

    let client: AuthClientLike;

    if (bearerToken) {
        client = createClient(supabaseUrl, anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }) as unknown as AuthClientLike;
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
