import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  createOrUpdateReview,
  type ReviewCreateBody,
  type ReviewCreateSupabaseLike,
} from '@/lib/reviewCreateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function runReviewCreateHttp(req: Request): Promise<NextResponse> {
  const result = await createOrUpdateReview({
    supabase: (await createSupabaseServerClient()) as unknown as ReviewCreateSupabaseLike,
    body: (await req.json()) as ReviewCreateBody,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
