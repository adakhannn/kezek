export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppAuthSendOtpHttp } from '@/lib/whatsAppAuthSendOtpHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/auth/whatsapp/send-otp', RateLimitConfigs.auth), () =>
    withErrorHandler('WhatsAppAuth', () => runWhatsAppAuthSendOtpHttp(req)),
  );
}
