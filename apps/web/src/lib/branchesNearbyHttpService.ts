import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { buildNearbyBranches } from '@/lib/branchesNearbyService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runBranchesNearbyHttp(req: Request): Promise<NextResponse> {
    const result = await buildNearbyBranches({
        supabase: createSupabaseAnonClient(),
        requestUrl: req.url,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
