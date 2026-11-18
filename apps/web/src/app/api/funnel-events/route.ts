import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runFunnelEventsHttp } from '@/lib/funnelEventsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/funnel-events
 * Сохраняет событие воронки в базу данных.
 * Не содержит PII, только анонимные идентификаторы. Лимит, размер и схема — API-09.
 */
export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.telemetry, () =>
        withErrorHandler('FunnelEventsAPI', async () => runFunnelEventsHttp(req)),
        '/api/funnel-events',
    );
}
