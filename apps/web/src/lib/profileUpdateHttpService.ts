import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  updateProfileSettings,
  type ProfileUpdateBody,
  type ProfileUpdateSupabaseLike,
} from '@/lib/profileUpdateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function runProfileUpdateHttp(req: Request): Promise<NextResponse> {
  const result = await updateProfileSettings({
    supabase: (await createSupabaseServerClient()) as unknown as ProfileUpdateSupabaseLike,
    body: (await req.json()) as ProfileUpdateBody,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
