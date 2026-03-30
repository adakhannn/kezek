import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import {
  runCreateVisitPackagePlanHttp,
  runListVisitPackagePlansHttp,
} from '@/lib/visitPackagePlansHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('VisitPackagePlansList', async () => runListVisitPackagePlansHttp(req));
}

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('VisitPackagePlansCreate', async () => runCreateVisitPackagePlanHttp(req)),
  );
}
