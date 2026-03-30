export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runRecalculateRatingsCronHttp } from '@/lib/recalculateRatingsCronHttpService';

export async function GET(req: Request) {
  return withErrorHandler('RecalculateRatingsCron', () => runRecalculateRatingsCronHttp(req));
}
