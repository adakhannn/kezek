import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runFunnelEventsHttp } from '@/lib/funnelEventsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/funnel-events
 * Сохраняет событие воронки в базу данных.
 * Не содержит PII, только анонимные идентификаторы.
 */
export async function POST(req: Request) {
    return withErrorHandler('FunnelEventsAPI', async () => runFunnelEventsHttp(req));
}
