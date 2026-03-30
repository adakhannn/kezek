import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { runInitializeRatingsRoute } from '@/lib/initializeRatingsRouteService';
import type { InitializeRatingsAdminLike } from '@/lib/initializeRatingsService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runInitializeRatingsHttp(req: Request): Promise<NextResponse> {
    const URL = getSupabaseUrl();
    const ANON = getSupabaseAnonKey();
    const cookieStore = await cookies();
    const supabase = createServerClient(URL, ANON, {
        cookies: {
            get: (name: string) => cookieStore.get(name)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    const body = (await req.json().catch(() => ({}))) as {
        days_back?: number;
        start_date?: string;
        end_date?: string;
        finalize_only?: boolean;
    };

    const result = await runInitializeRatingsRoute({
        supabase,
        admin: getServiceClient() as unknown as InitializeRatingsAdminLike,
        body,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.payload);
}
