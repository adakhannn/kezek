import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { findWhatsAppOwnerByPhone } from '@/lib/whatsAppIdentityOwnershipService';
import { runWhatsAppVerifyOtpRoute } from '@/lib/whatsAppVerifyOtpRouteService';
import type { SupabaseServerClientLike } from '@/lib/whatsAppVerifyOtpService';

export async function runWhatsAppVerifyOtpHttp(req: Request): Promise<NextResponse> {
  let code: string | undefined;
  try {
    const body = (await req.json()) as { code?: string };
    code = body.code;
  } catch (error) {
    logError('WhatsAppVerifyOtp', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const admin = createSupabaseAdminClient();
  const result = await runWhatsAppVerifyOtpRoute({
    supabase: (await createSupabaseServerClient()) as unknown as SupabaseServerClientLike,
    code,
    findAuthOwnerByPhone: (phone) => findWhatsAppOwnerByPhone(admin as never, phone),
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
