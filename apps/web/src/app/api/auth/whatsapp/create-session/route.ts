export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppCreateSessionHttp } from '@/lib/whatsAppCreateSessionHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/auth/whatsapp/create-session', RateLimitConfigs.auth), () =>
    withErrorHandler('WhatsAppAuth', () => runWhatsAppCreateSessionHttp(req)),
  );
}
