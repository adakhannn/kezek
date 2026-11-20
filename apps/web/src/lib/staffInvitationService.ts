import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Invitations to join a business team (API-06). A manager no longer links a staff card to someone's
 * account: the card is created without an account and the person gets a pending invitation. Only
 * the invited person links the card, by accepting it (accept_staff_invitation); the staff role then
 * follows the card (staff_ensure_staff_role). The table and both commands are service role only.
 */

export type PendingInvitation = { id: string; staff_id: string };

type InvitationLookup = { ok: true; invitation: PendingInvitation | null } | { ok: false };

/** The pending invitation of this person in this business, if any. */
export async function findPendingStaffInvitation(
    admin: SupabaseClient,
    bizId: string,
    userId: string,
): Promise<InvitationLookup> {
    const { data, error } = await admin
        .from('staff_invitations')
        .select('id, staff_id')
        .eq('biz_id', bizId)
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();
    if (error) return { ok: false };
    return { ok: true, invitation: (data as PendingInvitation | null) ?? null };
}

/**
 * Creates a pending invitation for the card, or returns the pending one that already exists for the
 * card or for this person in this business (a repeated or concurrent request creates nothing).
 */
export async function createPendingStaffInvitation(
    admin: SupabaseClient,
    { bizId, staffId, userId, invitedBy }: { bizId: string; staffId: string; userId: string; invitedBy: string | null },
): Promise<{ ok: true; invitation: PendingInvitation } | { ok: false }> {
    const { data, error } = await admin
        .from('staff_invitations')
        .insert({ biz_id: bizId, staff_id: staffId, invited_user_id: userId, invited_by: invitedBy })
        .select('id, staff_id')
        .single();
    if (!error && data) return { ok: true, invitation: data as PendingInvitation };

    // 23505: a pending invitation for this card or person was created concurrently.
    if ((error as { code?: string } | null)?.code === '23505') {
        const existing = await findPendingStaffInvitation(admin, bizId, userId);
        if (existing.ok && existing.invitation) return { ok: true, invitation: existing.invitation };
    }
    return { ok: false };
}

export type StaffInvitationListItem = {
    id: string;
    biz_id: string;
    staff_id: string;
    business_name: string | null;
    branch_name: string | null;
    created_at: string;
};

type InvitationRow = { id: string; biz_id: string; staff_id: string; created_at: string };
type StaffRow = { id: string; branch_id: string | null; user_id: string | null; biz_id: string };

/**
 * The caller's pending invitations with the business and branch names. An invitation whose card was
 * linked meanwhile or moved to another business is left out: accepting it would only cancel it.
 */
export async function listPendingStaffInvitations(
    admin: SupabaseClient,
    userId: string,
): Promise<{ ok: true; items: StaffInvitationListItem[] } | { ok: false }> {
    const { data, error } = await admin
        .from('staff_invitations')
        .select('id, biz_id, staff_id, created_at')
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    if (error) return { ok: false };
    const invitations = (data ?? []) as InvitationRow[];
    if (invitations.length === 0) return { ok: true, items: [] };

    const { data: staffRows, error: staffError } = await admin
        .from('staff')
        .select('id, biz_id, branch_id, user_id')
        .in('id', invitations.map((row) => row.staff_id));
    if (staffError) return { ok: false };
    const cards = new Map(((staffRows ?? []) as StaffRow[]).map((row) => [row.id, row]));
    const open = invitations.filter((row) => {
        const card = cards.get(row.staff_id);
        return card && card.user_id === null && card.biz_id === row.biz_id;
    });
    if (open.length === 0) return { ok: true, items: [] };

    const bizIds = [...new Set(open.map((row) => row.biz_id))];
    const branchIds = [...new Set(open.map((row) => cards.get(row.staff_id)?.branch_id).filter((id): id is string => !!id))];
    const [businesses, branches] = await Promise.all([
        admin.from('businesses').select('id, name').in('id', bizIds),
        branchIds.length > 0
            ? admin.from('branches').select('id, name').in('id', branchIds)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (businesses.error || branches.error) return { ok: false };
    const names = (rows: unknown) => new Map(((rows ?? []) as Array<{ id: string; name: string | null }>).map((row) => [row.id, row.name]));
    const businessNames = names(businesses.data);
    const branchNames = names(branches.data);

    return {
        ok: true,
        items: open.map((row) => {
            const branchId = cards.get(row.staff_id)?.branch_id ?? null;
            return {
                id: row.id,
                biz_id: row.biz_id,
                staff_id: row.staff_id,
                business_name: businessNames.get(row.biz_id) ?? null,
                branch_name: branchId ? branchNames.get(branchId) ?? null : null,
                created_at: row.created_at,
            };
        }),
    };
}

export type InvitationDecisionError = {
    ok: false;
    status: 404 | 409 | 500;
    error: 'not_found' | 'conflict' | 'internal';
    message: string;
};

const DECISION_ERRORS: Record<string, Omit<InvitationDecisionError, 'ok'>> = {
    STAFF_INVITATION_NOT_FOUND: { status: 404, error: 'not_found', message: 'Приглашение не найдено' },
    STAFF_INVITATION_NOT_PENDING: { status: 409, error: 'conflict', message: 'Приглашение уже обработано' },
    STAFF_INVITATION_STALE: { status: 409, error: 'conflict', message: 'Приглашение больше не действует: карточка сотрудника изменилась' },
    STAFF_INVITATION_ALREADY_STAFF: { status: 409, error: 'conflict', message: 'Вы уже в команде этого бизнеса' },
};

function decisionError(code: string | undefined): InvitationDecisionError {
    const known = code ? Object.keys(DECISION_ERRORS).find((key) => code.includes(key)) : undefined;
    if (known) return { ok: false, ...DECISION_ERRORS[known] };
    return { ok: false, status: 500, error: 'internal', message: 'Не удалось обработать приглашение' };
}

/** Accepts the caller's invitation: the card is linked to the caller's account. */
export async function acceptStaffInvitation(
    admin: SupabaseClient,
    invitationId: string,
    userId: string,
): Promise<{ ok: true; data: { staff_id: string; biz_id: string } } | InvitationDecisionError> {
    const { data, error } = await admin.rpc('accept_staff_invitation', {
        p_invitation_id: invitationId,
        p_user_id: userId,
    });
    if (error) return decisionError(error.message);
    const result = (data ?? {}) as { status?: string; staff_id?: string; biz_id?: string; error?: string };
    if (result.status !== 'accepted' || !result.staff_id || !result.biz_id) {
        return decisionError(result.error);
    }
    return { ok: true, data: { staff_id: result.staff_id, biz_id: result.biz_id } };
}

/** Declines the caller's invitation; the card stays an unlinked card of the business. */
export async function declineStaffInvitation(
    admin: SupabaseClient,
    invitationId: string,
    userId: string,
): Promise<{ ok: true } | InvitationDecisionError> {
    const { error } = await admin.rpc('decline_staff_invitation', {
        p_invitation_id: invitationId,
        p_user_id: userId,
    });
    if (error) return decisionError(error.message);
    return { ok: true };
}

/** The staff cards of this business with a pending invitation, for the dashboard staff list. */
export async function listPendingInvitationStaffIds(
    admin: SupabaseClient,
    bizId: string,
): Promise<{ ok: true; staffIds: string[] } | { ok: false }> {
    const { data, error } = await admin
        .from('staff_invitations')
        .select('staff_id')
        .eq('biz_id', bizId)
        .eq('status', 'pending');
    if (error) return { ok: false };
    return { ok: true, staffIds: [...new Set(((data ?? []) as Array<{ staff_id: string }>).map((row) => row.staff_id))] };
}

export const STAFF_INVITATION_PENDING_NOT_FOUND_MESSAGE = 'У этого сотрудника нет ожидающего приглашения';
export const STAFF_INVITATION_CANCEL_FAILED_MESSAGE = 'Не удалось отменить приглашение';

/**
 * Cancels the pending invitation of a staff card, by the business. The card stays, unlinked; the
 * owner can delete it or reuse it. 404 when the card of this business has no pending invitation.
 */
export async function cancelPendingStaffInvitation(
    admin: SupabaseClient,
    bizId: string,
    staffId: string,
): Promise<{ ok: true; data: { invitation_id: string } } | { ok: false; status: 404 | 500; error: 'not_found' | 'internal'; message: string }> {
    const { data, error } = await admin
        .from('staff_invitations')
        .update({ status: 'cancelled', decided_at: new Date().toISOString() })
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('status', 'pending')
        .select('id');
    if (error) return { ok: false, status: 500, error: 'internal', message: STAFF_INVITATION_CANCEL_FAILED_MESSAGE };
    const rows = (data ?? []) as Array<{ id: string }>;
    if (rows.length === 0) return { ok: false, status: 404, error: 'not_found', message: STAFF_INVITATION_PENDING_NOT_FOUND_MESSAGE };
    return { ok: true, data: { invitation_id: rows[0].id } };
}
