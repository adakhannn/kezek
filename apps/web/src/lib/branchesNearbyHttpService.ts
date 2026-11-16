import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { asDiscoveryClient } from '@/lib/branches/approvedBranches';
import { buildNearbyBranches } from '@/lib/branchesNearbyService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runBranchesNearbyHttp(req: Request): Promise<NextResponse> {
    const result = await buildNearbyBranches({
        supabase: asDiscoveryClient(createSupabaseAnonClient()),
        requestUrl: req.url,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
