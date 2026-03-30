import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runWhatsAppSendOtpRoute } from '@/lib/whatsAppSendOtpRouteService';
import type { WhatsAppSendOtpSupabaseLike } from '@/lib/whatsAppSendOtpService';

export async function runWhatsAppSendOtpHttp(): Promise<NextResponse> {
  const result = await runWhatsAppSendOtpRoute({
    supabase: (await createSupabaseServerClient()) as unknown as WhatsAppSendOtpSupabaseLike,
  });

  if (!result.ok) {
    if (result.error === 'validation' || result.error === 'internal') {
      logError('WhatsAppSendOtp', result.message, result.details);
    }
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
