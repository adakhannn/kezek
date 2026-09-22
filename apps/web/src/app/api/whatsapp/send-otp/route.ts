// apps/web/src/app/api/whatsapp/send-otp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppSendOtpHttp } from '@/lib/whatsAppSendOtpHttpService';

/**
 * POST /api/whatsapp/send-otp
 * Отправляет OTP код на WhatsApp номер пользователя для подтверждения
 */
export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/whatsapp/send-otp', RateLimitConfigs.auth), async () =>
    withErrorHandler('WhatsAppSendOtp', () => runWhatsAppSendOtpHttp(req)),
  );
}
