import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runVisitPackagePlanPatchHttp } from '@/lib/visitPackagePlanPatchHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('VisitPackagePlanPatch', async () => runVisitPackagePlanPatchHttp(req, context)),
  );
}
