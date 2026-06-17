import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listMobileBusinesses } from '@/lib/mobileBusinessesService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runMobileBusinessesHttp(req: Request): Promise<NextResponse> {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const result = await listMobileBusinesses({
        supabase: createSupabaseAnonClient() as never,
        search: url.searchParams.get('search') ?? undefined,
        category: url.searchParams.get('category') ?? undefined,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 20,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
