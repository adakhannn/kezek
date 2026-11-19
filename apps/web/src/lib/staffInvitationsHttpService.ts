import { isUuid } from '@shared-client/validation';
import type { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRouteParam } from '@/lib/routeParams';
import {
    acceptStaffInvitation,
    declineStaffInvitation,
    listPendingStaffInvitations,
} from '@/lib/staffInvitationService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

/**
 * The invited person's side of staff invitations (API-06): the signed-in user lists, accepts and
 * declines only their own invitations. The cookie session identifies the user; the service client
 * reads and calls the commands, which check that the invitation is theirs.
 */
async function signedInUser() {
    const { supabase, admin } = await createSupabaseClients();
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data?.user ?? null;
    return { admin, userId: user?.id ?? null };
}

const unauthorized = () => createErrorResponse('auth', 'Не авторизован', undefined, 401);

export async function runListStaffInvitationsHttp(): Promise<NextResponse> {
    const { admin, userId } = await signedInUser();
    if (!userId) return unauthorized();

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

export async function runAcceptStaffInvitationHttp(context: unknown): Promise<NextResponse> {
    const { admin, userId } = await signedInUser();
    if (!userId) return unauthorized();
    const id = await invitationId(context);
    if (!id) return createErrorResponse('not_found', 'Приглашение не найдено', undefined, 404);

    const result = await acceptStaffInvitation(admin, id, userId);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }
    return createSuccessResponse(result.data);
}

export async function runDeclineStaffInvitationHttp(context: unknown): Promise<NextResponse> {
    const { admin, userId } = await signedInUser();
    if (!userId) return unauthorized();
    const id = await invitationId(context);
    if (!id) return createErrorResponse('not_found', 'Приглашение не найдено', undefined, 404);

    const result = await declineStaffInvitation(admin, id, userId);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }
    return createSuccessResponse();
}
