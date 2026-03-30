import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppAuthSendOtpRoute } from '@/lib/whatsAppAuthSendOtpRouteService';
import type { WhatsAppAuthSendOtpAdminLike } from '@/lib/whatsAppAuthSendOtpService';

export async function runWhatsAppAuthSendOtpHttp(req: Request): Promise<NextResponse> {
  let phone: string | undefined;
  try {
    const body = (await req.json()) as { phone?: string };
    phone = body.phone;
  } catch (error) {
    logError('WhatsAppAuth', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const result = await runWhatsAppAuthSendOtpRoute({
    admin: createSupabaseAdminClient() as unknown as WhatsAppAuthSendOtpAdminLike,
    phone,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
