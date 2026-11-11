// Legacy POST/PUT aliases intentionally share the validated PATCH contract.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { updateBranch, type BranchUpdateAdminLike } from '@/lib/branchUpdateService';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { branchUpdateSchema } from '@/lib/validation/businessUpdateSchemas';


async function handler(req: Request, context: unknown) {
    return withErrorHandler('AdminBranchUpdate', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const bizId = await getRouteParamRequired(context, 'id');
        const branchId = await getRouteParamRequired(context, 'branchId');
        const validation = await validateRequest(req, branchUpdateSchema);
        if (!validation.success) return validation.response;
        const result = await updateBranch({
            admin: getServiceClient() as unknown as BranchUpdateAdminLike,
            bizId, branchId, body: validation.data,
        });
        if (!result.ok) return createErrorResponse(result.error, result.message, result.details, result.status);
        return NextResponse.json({ ok: true, updated: true });
    });
}

export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export function OPTIONS() { return new Response(null, { status: 204 }); }
