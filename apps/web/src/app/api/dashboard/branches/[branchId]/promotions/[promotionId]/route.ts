import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDeleteBranchPromotionHttp, runUpdateBranchPromotionHttp } from '@/lib/branchPromotionHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, context: unknown) {
    return withErrorHandler('BranchPromotion', async () => runUpdateBranchPromotionHttp(req, context));
}

export async function DELETE(req: Request, context: unknown) {
    return withErrorHandler('BranchPromotion', async () => runDeleteBranchPromotionHttp(req, context));
}
