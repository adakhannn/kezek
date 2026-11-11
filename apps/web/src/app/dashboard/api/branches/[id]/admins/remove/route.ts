import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchAdminChangeHttp } from '@/lib/branchAdminChangeHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('BranchAdminChange', () => runBranchAdminChangeHttp(req, context, 'remove'));
}
