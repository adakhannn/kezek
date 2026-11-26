import { isUuid } from '@shared-client/validation';
import type { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { getRouteParam } from '@/lib/routeParams';
import {
    acceptStaffInvitation,
    declineStaffInvitation,
    listPendingStaffInvitations,
} from '@/lib/staffInvitationService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

/**
 * The invited person's side of staff invitations (API-06): the signed-in user lists, accepts and
 * declines only their own invitations. The cookie session or the app's Bearer token (C13) identifies the user; the service client
 * reads and calls the commands, which check that the invitation is theirs.
 */
async function signedInUser(req: Request) {
    const supabase = await createRequestSupabaseClient(req);
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data?.user ?? null;
    return { admin: user ? createSupabaseAdminClient() : null, userId: user?.id ?? null };
}

const unauthorized = () => createErrorResponse('auth', 'Не авторизован', undefined, 401);

export async function runListStaffInvitationsHttp(req: Request): Promise<NextResponse> {
    const { admin, userId } = await signedInUser(req);
    if (!userId || !admin) return unauthorized();

    const result = await listPendingStaffInvitations(admin, userId);
    if (!result.ok) {
        return createErrorResponse('internal', 'Не удалось загрузить приглашения', undefined, 500);
    }
    return createSuccessResponse({ invitations: result.items });
}

async function invitationId(context: unknown): Promise<string | null> {
    const id = (await getRouteParam(context, 'id'))?.trim() ?? '';
    return isUuid(id) ? id : null;
}

export async function runAcceptStaffInvitationHttp(req: Request, context: unknown): Promise<NextResponse> {
    const { admin, userId } = await signedInUser(req);
    if (!userId || !admin) return unauthorized();
    const id = await invitationId(context);
    if (!id) return createErrorResponse('not_found', 'Приглашение не найдено', undefined, 404);

    const result = await acceptStaffInvitation(admin, id, userId);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }
    return createSuccessResponse(result.data);
}

export async function runDeclineStaffInvitationHttp(req: Request, context: unknown): Promise<NextResponse> {
    const { admin, userId } = await signedInUser(req);
    if (!userId || !admin) return unauthorized();
    const id = await invitationId(context);
    if (!id) return createErrorResponse('not_found', 'Приглашение не найдено', undefined, 404);

    const result = await declineStaffInvitation(admin, id, userId);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }
    return createSuccessResponse();
}
