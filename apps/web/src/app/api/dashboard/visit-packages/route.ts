import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runListVisitPackagesHttp } from '@/lib/visitPackagesHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('VisitPackagesList', async () => runListVisitPackagesHttp(req));
}
