export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppVerifyOtpHttp } from '@/lib/whatsAppVerifyOtpHttpService';

/**
 * POST /api/whatsapp/verify-otp
 * Проверяет OTP код и подтверждает WhatsApp номер
 */
export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/whatsapp/verify-otp', RateLimitConfigs.auth), async () =>
    withErrorHandler('WhatsAppVerifyOtp', () => runWhatsAppVerifyOtpHttp(req)),
  );
}
