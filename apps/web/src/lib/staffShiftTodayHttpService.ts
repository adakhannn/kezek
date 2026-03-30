import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContext } from '@/lib/authBiz';
import { logWarn } from '@/lib/log';
import { runStaffShiftToday } from '@/lib/staffShiftTodayService';

export async function runStaffShiftTodayHttp(): Promise<NextResponse> {
    logWarn('StaffShiftToday', 'Deprecated endpoint used. Please migrate to /api/staff/finance');

    const { supabase, staffId, bizId } = await getStaffContext();
    const result = await runStaffShiftToday({ supabase, staffId, bizId });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
