import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import {
  createOrUpdateReview,
  type ReviewCreateBody,
} from '@/lib/reviewCreateService';

export async function runReviewCreateHttp(req: Request): Promise<NextResponse> {
  const result = await createOrUpdateReview({
    // The web session cookie or the app's Bearer token (C9).
    supabase: await createRequestSupabaseClient(req),
    body: (await req.json()) as ReviewCreateBody,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
