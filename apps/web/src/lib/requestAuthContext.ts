import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import type { DbClient } from '@/lib/supabaseTypes';
import type { Database } from '@/types/supabase';

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

/**
 * The signed-in caller of a public endpoint, or null (anonymous; never a 401). A mobile Bearer
 * token and the web session cookie both identify the caller (API-09, CI-09: mobile beacons were
 * stored as anonymous because only cookies were read).
 */
export async function resolveOptionalRequestUser(req: Request): Promise<User | null> {
    try {
        const header = req.headers.get('Authorization') ?? '';
        if (/^Bearer [^.s]+.[^.s]+.[^.s]+$/.test(header)) {
            const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
                global: { headers: { Authorization: header } },
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data, error } = await supabase.auth.getUser();
            return error ? null : data.user ?? null;
        }
        const supabase = await createSupabaseServerClient();
        const { data, error } = await supabase.auth.getUser();
        return error ? null : data.user ?? null;
    } catch {
        return null;
    }
}

/**
 * The Supabase client acting as the caller, without deciding the 401 (services that check the user
 * themselves answer it). A mobile Bearer token is used when present, the web session cookie
 * otherwise, so the same route serves the website and the app (C9, C10, C13, B5).
 */
export async function createRequestSupabaseClient(req: Request): Promise<DbClient> {
    const header = req.headers.get('Authorization') ?? '';
    if (header.startsWith('Bearer ') && header.length > 'Bearer '.length) {
        return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
            global: { headers: { Authorization: header } },
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return createSupabaseServerClient();
}

/** The request carries a non-empty `Authorization: Bearer` token (the mobile app). */
export function hasBearerAuthorization(req: Request): boolean {
    const header = req.headers.get('Authorization') ?? '';
    return header.startsWith('Bearer ') && header.length > 'Bearer '.length;
}
