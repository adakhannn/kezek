import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
    getCurrentBusinessState,
    setCurrentBusinessState,
} from '@/lib/currentBusinessService';
import { logWarn } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import type { DbClient } from '@/lib/supabaseTypes';

export async function getCurrentBusinessClients(): Promise<{
    supabase: DbClient;
    admin: DbClient;
}> {
    const supabase = await createSupabaseServerClient();
    let admin: DbClient = supabase;
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
        supabase,
        admin,
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
        supabase,
        admin,
        bizId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse();
}
