import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listMobileBusinesses } from '@/lib/mobileBusinessesService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runMobileBusinessesHttp(req: Request): Promise<NextResponse> {
    const url = new URL(req.url);
    const result = await listMobileBusinesses({
        supabase: createSupabaseAnonClient() as never,
        search: url.searchParams.get('search') ?? undefined,
        category: url.searchParams.get('category') ?? undefined,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
