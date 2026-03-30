import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createBranchPromotion, listBranchPromotions } from '@/lib/branchPromotionsService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runListBranchPromotionsHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'branchId');

    return withManagerContext(req, 'BranchPromotions', async ({ admin, bizId }) => {
        const result = await listBranchPromotions({
            admin,
            branchId,
            bizId,
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse(result.payload);
    });
}

export async function runCreateBranchPromotionHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'branchId');
    const body = await req.json();

    return withManagerContext(req, 'BranchPromotions', async ({ admin, bizId }) => {
        const result = await createBranchPromotion({
            admin,
            branchId,
            bizId,
            body,
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse(result.payload);
    });
}
