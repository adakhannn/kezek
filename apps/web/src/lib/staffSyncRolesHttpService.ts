import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { runStaffSyncRoles } from '@/lib/staffSyncRolesService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffSyncRolesHttp(): Promise<NextResponse> {
    const { supabase, bizId } = await getBizContextForManagers();

    const result = await runStaffSyncRoles({
        supabase: supabase as never,
        admin: getServiceClient() as never,
        bizId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
