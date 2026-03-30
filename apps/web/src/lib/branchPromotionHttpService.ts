import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { deleteBranchPromotion, updateBranchPromotion } from '@/lib/branchPromotionService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runUpdateBranchPromotionHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'branchId');
    const promotionId = await getRouteParamUuid(context, 'promotionId');
    const body = await req.json();

    return withManagerContext(req, 'BranchPromotion', async ({ admin, bizId }) => {
        const result = await updateBranchPromotion({
            admin,
            branchId,
            promotionId,
            bizId,
            body,
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse(result.payload);
    });
}

export async function runDeleteBranchPromotionHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'branchId');
    const promotionId = await getRouteParamUuid(context, 'promotionId');

    return withManagerContext(req, 'BranchPromotion', async ({ admin, bizId }) => {
        const result = await deleteBranchPromotion({
            admin,
            branchId,
            promotionId,
            bizId,
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse();
    });
}
