import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { cancelPendingStaffInvitation } from '@/lib/staffInvitationService';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * Cancels the pending invitation of a staff card (API-06), for a manager of the card's business. The
 * update is limited to the business and the card, so another business's invitation is never touched.
 */
export async function runStaffInvitationCancelHttp(context: unknown): Promise<NextResponse> {
    const staffId = await getRouteParamUuid(context, 'id');
    const { bizId } = await getBizContextForManagers();
    const result = await cancelPendingStaffInvitation(getServiceClient(), bizId, staffId);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }
    return createSuccessResponse(result.data);
}
