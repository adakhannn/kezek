import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { runReviewUpdate } from '@/lib/reviewUpdateService';

type Body = { review_id: string; rating: number; comment?: string };

export async function runReviewUpdateHttp(req: Request): Promise<NextResponse> {
    const body = (await req.json()) as Body;
    // The web session cookie or the app's Bearer token (C9).
    const supabase = await createRequestSupabaseClient(req);
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
