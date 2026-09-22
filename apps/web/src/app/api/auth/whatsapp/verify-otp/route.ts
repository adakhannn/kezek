export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppAuthVerifyOtpHttp } from '@/lib/whatsAppAuthVerifyOtpHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/auth/whatsapp/verify-otp', RateLimitConfigs.auth), () =>
    withErrorHandler('WhatsAppAuth', () => runWhatsAppAuthVerifyOtpHttp(req)),
  );
}
