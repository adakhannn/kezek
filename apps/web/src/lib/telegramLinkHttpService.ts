import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { linkTelegramAccount, type TelegramLinkSupabaseLike } from '@/lib/telegramLinkService';
import type { TelegramAuthData } from '@/lib/telegram/verify';
import { validateRequest } from '@/lib/validation/apiValidation';
import { telegramAuthDataSchema } from '@/lib/validation/schemas';

export async function runTelegramLinkHttp(req: Request): Promise<NextResponse> {
  const { supabase, admin } = await createSupabaseClients();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

  const validationResult = await validateRequest(req, telegramAuthDataSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const result = await linkTelegramAccount({
    admin: admin as unknown as TelegramLinkSupabaseLike,
    user: {
      id: user.id,
      user_metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    },
    body: validationResult.data as TelegramAuthData,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
