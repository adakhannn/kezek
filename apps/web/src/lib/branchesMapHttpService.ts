import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { asDiscoveryClient } from '@/lib/branches/approvedBranches';
import { listBranchesMap } from '@/lib/branchesMapService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runBranchesMapHttp(req: Request): Promise<NextResponse> {
    const url = new URL(req.url);
    // The public map lists active branches only; a deactivated branch is hidden on purpose.
    const result = await listBranchesMap({
        supabase: asDiscoveryClient(createSupabaseAnonClient()),
        cityId: (url.searchParams.get('cityId') ?? '').trim() || undefined,
        categoryId: (url.searchParams.get('categoryId') ?? '').trim() || undefined,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
