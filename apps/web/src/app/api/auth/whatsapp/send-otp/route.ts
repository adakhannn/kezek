export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppAuthSendOtpHttp } from '@/lib/whatsAppAuthSendOtpHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.auth, () =>
    withErrorHandler('WhatsAppAuth', () => runWhatsAppAuthSendOtpHttp(req)),
  );
}
