import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runWhatsAppCreateSessionRoute } from '@/lib/whatsAppCreateSessionRouteService';
import type { WhatsAppSessionAdminClientLike } from '@/lib/whatsAppCreateSessionService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { createWhatsAppSessionSchema } from '@/lib/validation/schemas';

export async function runWhatsAppCreateSessionHttp(req: Request): Promise<NextResponse> {
  const validationResult = await validateRequest(req, createWhatsAppSessionSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { phone, userId } = validationResult.data;
  const result = await runWhatsAppCreateSessionRoute({
    admin: createSupabaseAdminClient() as unknown as WhatsAppSessionAdminClientLike,
    phone,
    userId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.payload);
}
