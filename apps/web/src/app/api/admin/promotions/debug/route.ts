import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runPromotionsDebugHttp } from '@/lib/promotionsDebugHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(request: Request) {
  return withRateLimit(request, RateLimitConfigs.normal, () =>
    withErrorHandler('PromotionsDebug', async () => runPromotionsDebugHttp(request)),
  );
}
