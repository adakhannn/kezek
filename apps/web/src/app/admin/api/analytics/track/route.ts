import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const trackEventSchema = z.object({
  event_type: z.string().min(1),
  biz_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  booking_id: z.string().uuid().nullable().optional(),
  source: z.string().min(1),
  session_id: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(req: Request) {
  return withErrorHandler('AnalyticsTrackEvent', async () => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const validation = await validateRequest(req, trackEventSchema);
    if (!validation.success) {
      return validation.response;
    }

    const payload = validation.data;

    // Анонимным пользователям разрешаем логировать только безопасные публичные события
    if (!user) {
      const allowedPublicEvents = new Set([
        'home_view',
        'business_page_view',
        'booking_flow_start',
        'booking_flow_step',
      ]);
      if (!allowedPublicEvents.has(payload.event_type)) {
        return createErrorResponse('auth', 'Unauthorized analytics event', undefined, 401);
      }
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient.from('analytics_events').insert({
      event_type: payload.event_type,
      biz_id: payload.biz_id ?? null,
      branch_id: payload.branch_id ?? null,
      booking_id: payload.booking_id ?? null,
      client_id: user?.id ?? null,
      source: payload.source,
      session_id: payload.session_id ?? null,
      metadata: payload.metadata ?? {},
    });

    if (error) {
      return createErrorResponse('server', 'Failed to log analytics event', { error: error.message }, 500);
    }

    return createSuccessResponse({ ok: true });
  });
}

