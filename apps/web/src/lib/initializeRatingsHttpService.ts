import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runInitializeRatingsRoute } from '@/lib/initializeRatingsRouteService';
import type { InitializeRatingsAdminLike } from '@/lib/initializeRatingsService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runInitializeRatingsHttp(req: Request): Promise<NextResponse> {
    const supabase = await createSupabaseServerClient();

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
