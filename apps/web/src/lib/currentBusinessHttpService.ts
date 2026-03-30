import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
    getCurrentBusinessState,
    setCurrentBusinessState,
    type CurrentBusinessAdminClientLike,
    type CurrentBusinessServerClientLike,
} from '@/lib/currentBusinessService';
import { logWarn } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function getCurrentBusinessClients(): Promise<{
    supabase: SupabaseClient;
    admin: SupabaseClient;
}> {
    const supabase = await createSupabaseServerClient();
    let admin: SupabaseClient = supabase;
    try {
        admin = createSupabaseAdminClient();
    } catch (error) {
        logWarn(
            'GetCurrentBusiness',
            'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS)',
            {
                error: error instanceof Error ? error.message : String(error),
            },
        );
        admin = supabase;
    }

    return { supabase, admin };
}

export async function runGetCurrentBusinessHttp(): Promise<NextResponse> {
    const { supabase, admin } = await getCurrentBusinessClients();
    const result = await getCurrentBusinessState({
        supabase: supabase as unknown as CurrentBusinessServerClientLike,
        admin: admin as unknown as CurrentBusinessAdminClientLike,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}

export async function runSetCurrentBusinessHttp(req: Request): Promise<NextResponse> {
    const { supabase, admin } = await getCurrentBusinessClients();
    const body = await req.json().catch(() => ({}));
    const bizId = typeof body.bizId === 'string' ? body.bizId.trim() : null;

    const result = await setCurrentBusinessState({
        supabase: supabase as unknown as CurrentBusinessServerClientLike,
        admin: admin as unknown as CurrentBusinessAdminClientLike,
        bizId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse();
}
