import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { buildNearbyBranches } from '@/lib/branchesNearbyService';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

export async function runBranchesNearbyHttp(req: Request): Promise<NextResponse> {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await buildNearbyBranches({
        supabase,
        requestUrl: req.url,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
