import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContext } from '@/lib/authBiz';
import { runStaffAvatarRemove } from '@/lib/staffAvatarRemoveService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffAvatarRemoveHttp(): Promise<NextResponse> {
    const { staffId, bizId } = await getStaffContext();

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
