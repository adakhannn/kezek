import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  updateProfileSettings,
  type ProfileUpdateBody,
  type ProfileUpdateSupabaseLike,
} from '@/lib/profileUpdateService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

/** Accepts the web cookie session and the mobile `Authorization: Bearer` session. */
export async function runProfileUpdateHttp(req: Request): Promise<NextResponse> {
  const authContext = await resolveRequestAuthContext(req, 'ProfileUpdate');
  if (authContext instanceof Response) {
    return authContext as NextResponse;
  }

  const body = (await req.json().catch(() => null)) as ProfileUpdateBody | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  // A bearer client has no stored Auth session, so auth.updateUser is not
  // available; the name is mirrored to metadata with a targeted admin merge.
  const updateFullNameMetadata =
    authContext.authSource === 'bearer'
      ? async (fullName: string | null) => {
          await createSupabaseAdminClient().auth.admin.updateUserById(authContext.user.id, {
            user_metadata: { full_name: fullName },
          });
        }
      : undefined;

  const result = await updateProfileSettings({
    supabase: authContext.supabase as unknown as ProfileUpdateSupabaseLike,
    body,
    updateFullNameMetadata,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
