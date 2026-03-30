import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listBranchesMap } from '@/lib/branchesMapService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runBranchesMapHttp(req: Request): Promise<NextResponse> {
    const url = new URL(req.url);
    const onlyActiveParam = url.searchParams.get('onlyActive');
    const result = await listBranchesMap({
        supabase: createSupabaseAnonClient(),
        cityId: (url.searchParams.get('cityId') ?? '').trim() || undefined,
        categoryId: (url.searchParams.get('categoryId') ?? '').trim() || undefined,
        onlyActive: onlyActiveParam == null ? true : onlyActiveParam !== 'false',
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
