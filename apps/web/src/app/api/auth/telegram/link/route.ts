// apps/web/src/app/api/auth/telegram/link/route.ts
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runTelegramLinkHttp } from '@/lib/telegramLinkHttpService';

/**
 * POST /api/auth/telegram/link
 * Связывает Telegram аккаунт с текущим залогиненным пользователем
 */
export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.auth, async () =>
    withErrorHandler('TelegramLink', () => runTelegramLinkHttp(req)),
  );
}
