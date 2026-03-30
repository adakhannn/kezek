import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runMeVisitPackagesHttp } from '@/lib/meVisitPackagesHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('MeVisitPackages', async () => runMeVisitPackagesHttp(req));
}
