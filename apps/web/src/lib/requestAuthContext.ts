import type { NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export type RequestAuthContext = {
    supabase: SupabaseClient;
    user: User;
    authSource: 'bearer' | 'cookie';
};

export async function resolveRequestAuthContext(
    req: Request,
    scope: string,
): Promise<RequestAuthContext | NextResponse> {
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    if (bearerToken) {
        const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
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

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            logError(scope, 'Bearer token auth failed', {
                error: error?.message || 'No user',
                hasToken: !!bearerToken,
                tokenLength: bearerToken.length,
            });
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }

        logDebug(scope, 'Bearer token auth successful', { userId: user.id });
        return { supabase, user, authSource: 'bearer' };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return createErrorResponse('auth', 'Not signed in', undefined, 401);
    }

    return { supabase, user, authSource: 'cookie' };
}
