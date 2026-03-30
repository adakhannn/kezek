import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runReviewUpdate } from '@/lib/reviewUpdateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = { review_id: string; rating: number; comment?: string };

export async function runReviewUpdateHttp(req: Request): Promise<NextResponse> {
    const body = (await req.json()) as Body;
    const supabase = await createSupabaseServerClient();
    const result = await runReviewUpdate({ supabase, body });

    if (!result.ok) {
        return createErrorResponse(
            result.error,
            result.message,
            undefined,
            result.status,
        );
    }

    return createSuccessResponse(result.payload);
}
