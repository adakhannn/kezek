import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppAuthVerifyOtpRoute } from '@/lib/whatsAppAuthVerifyOtpRouteService';
import type { SupabaseAdminClientLike } from '@/lib/whatsAppAuthVerifyOtpService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { verifyWhatsAppOtpSchema } from '@/lib/validation/schemas';

export async function runWhatsAppAuthVerifyOtpHttp(req: Request): Promise<NextResponse> {
  const validationResult = await validateRequest(req, verifyWhatsAppOtpSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { phone, code } = validationResult.data;
  const result = await runWhatsAppAuthVerifyOtpRoute({
    admin: createSupabaseAdminClient() as unknown as SupabaseAdminClientLike,
    phone,
    code,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.payload);
}
