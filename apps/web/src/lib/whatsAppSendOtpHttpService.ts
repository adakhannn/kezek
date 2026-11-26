import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { runWhatsAppSendOtpRoute } from '@/lib/whatsAppSendOtpRouteService';

export async function runWhatsAppSendOtpHttp(req: Request): Promise<NextResponse> {
  let phone: string | undefined;
  try {
    const body = (await req.json()) as { phone?: unknown };
    phone = typeof body.phone === 'string' ? body.phone : undefined;
  } catch {
    phone = undefined;
  }

  const result = await runWhatsAppSendOtpRoute({
    // The web session cookie or the app's Bearer token (B5).
    supabase: await createRequestSupabaseClient(req),
    phone,
  });

  if (!result.ok) {
    if (result.error === 'validation' || result.error === 'internal') {
      logError('WhatsAppSendOtp', 'Send OTP request failed', { status: result.status, message: result.message, details: result.details });
    }
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
