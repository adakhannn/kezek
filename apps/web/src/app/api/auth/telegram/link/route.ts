// apps/web/src/app/api/auth/telegram/link/route.ts
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramLinkHttp } from '@/lib/telegramLinkHttpService';

/**
 * POST /api/auth/telegram/link
 * Связывает Telegram аккаунт с текущим залогиненным пользователем
 */
export async function POST(req: Request) {
  return withRateLimit(req, routeRateLimit('api/auth/telegram/link', RateLimitConfigs.auth), async () =>
    withErrorHandler('TelegramLink', () => runTelegramLinkHttp(req)),
  );
}
