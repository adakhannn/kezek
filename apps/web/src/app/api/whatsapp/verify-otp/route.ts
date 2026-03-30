export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppVerifyOtpHttp } from '@/lib/whatsAppVerifyOtpHttpService';

/**
 * POST /api/whatsapp/verify-otp
 * Проверяет OTP код и подтверждает WhatsApp номер
 */
export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.auth, async () =>
    withErrorHandler('WhatsAppVerifyOtp', () => runWhatsAppVerifyOtpHttp(req)),
  );
}
