export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { runBranchDeleteHttp } from '@/lib/branchDeleteHttpService';

export async function POST(_req: Request, context: unknown) {
    return withErrorHandler('BranchesDelete', async () => runBranchDeleteHttp(context));
}
