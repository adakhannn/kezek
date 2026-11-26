import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { runStaffAvatarRemove } from '@/lib/staffAvatarRemoveService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffAvatarRemoveHttp(req: Request): Promise<NextResponse> {
    // Cookie session (website) or Bearer token (mobile app); X-Kezek-Staff-Id names the card.
    const { staffId, bizId } = await getStaffContextForRequest(req, 'StaffAvatarRemove');

    const admin = getServiceClient();
    const result = await runStaffAvatarRemove({
        admin,
        staffId,
        bizId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
