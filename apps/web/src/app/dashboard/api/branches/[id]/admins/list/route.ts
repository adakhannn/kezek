import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchAdminListHttp } from '@/lib/branchAdminListHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, context: unknown) {
    return withErrorHandler('BranchAdminList', () => runBranchAdminListHttp(context));
}
