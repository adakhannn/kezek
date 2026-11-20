import type { SupabaseClient } from '@supabase/supabase-js';

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logDebug, logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { notifyNewStaffInvitation } from '@/lib/staffInvitationNotification';
import { createPendingStaffInvitation, findPendingStaffInvitation } from '@/lib/staffInvitationService';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { todayDateString } from '@/lib/time';

type StaffCreateFromUserInput = {
    admin: SupabaseClient;
    bizId: string;
    /** The manager who sends the invitation. */
    invitedBy: string | null;
    body: {
        user_id: string;
        branch_id: string;
        is_active?: boolean;
    };
};

type StaffCreateFromUserFailure = {
    ok: false;
    status: 400 | 403 | 404 | 500;
    error: 'validation' | 'forbidden' | 'not_found' | 'internal';
    message: string;
};

export const STAFF_INVITATION_SENT_MESSAGE = 'Приглашение отправлено. Сотрудник появится в команде после подтверждения.';
export const STAFF_ALREADY_IN_TEAM_MESSAGE = 'Этот пользователь уже в команде бизнеса.';

type StaffCreateFromUserSuccess = {
    ok: true;
    message: string;
    data: {
        id: string;
        staff_id: string;
        /** null when the account already has its own card in this business. */
        invitation_id: string | null;
        status: 'pending' | 'already_staff';
        schedule_initialized: boolean;
        schedule_days_created: number;
        schedule_error: string | null;
    };
};

type StaffCreateFromUserResult =
    | StaffCreateFromUserFailure
    | StaffCreateFromUserSuccess;

const internalError = (message: string): StaffCreateFromUserFailure => ({ ok: false, status: 500, error: 'internal', message });

/**
 * Adds a person with an account to the team by invitation (API-06). The manager no longer links the
 * account: the card is created without user_id (and without the account's e-mail and phone), and the
 * person gets a pending invitation; the card is linked, and the staff role granted, only when they
 * accept it. A repeated request reuses the pending invitation and its card. An account that already
 * has its own card in the business keeps it, as before.
 */
export async function runStaffCreateFromUser({
    admin,
    bizId,
    invitedBy,
    body,
}: StaffCreateFromUserInput): Promise<StaffCreateFromUserResult> {
    if (!body.user_id || !body.branch_id) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'user_id и branch_id обязательны',
        };
    }

    const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        'branches',
        body.branch_id,
        bizId,
        'id, biz_id',
    );
    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Филиал не принадлежит этому бизнесу',
        };
    }

    // Exact lookup by id (ARCH-03): the first 200 users of listUsers did not contain older
    // accounts, which the manager search (find_accounts_by_contact) already finds.
    const { data: found, error: userError } = await admin.auth.admin.getUserById(body.user_id);
    const user = userError ? null : found?.user ?? null;
    if (!user) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Пользователь не найден',
        };
    }

    const meta = user.user_metadata ?? {};
    const fullName = String(meta.full_name ?? meta.fullName ?? user.email ?? 'Без имени');

    // A card already linked to this account is kept, so a repeated request creates nothing. A card is
    // never matched by name (ARCH-07): a namesake's unlinked card, with its bookings and finances, was
    // linked to this account, and a namesake's linked card was returned as this account's.
    const { data: existingStaff, error: existingError } = await admin
        .from('staff')
        .select('id')
        .eq('biz_id', bizId)
        .eq('user_id', body.user_id)
        .limit(1)
        .maybeSingle();
    if (existingError) {
        return internalError('Не удалось проверить сотрудников бизнеса');
    }

    let staffId = existingStaff?.id as string | undefined;
    let invitationId: string | null = null;

    if (!staffId) {
        const pending = await findPendingStaffInvitation(admin, bizId, body.user_id);
        if (!pending.ok) {
            return internalError('Не удалось проверить приглашения');
        }
        if (pending.invitation) {
            staffId = pending.invitation.staff_id;
            invitationId = pending.invitation.id;
        }
    }

    if (!staffId) {
        const { data: inserted, error: insertError } = await admin
            .from('staff')
            .insert({
                biz_id: bizId,
                branch_id: body.branch_id,
                full_name: fullName,
                is_active: body.is_active ?? true,
                user_id: null,
            })
            .select('id')
            .single();

        if (insertError) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: insertError.message,
            };
        }

        const newStaffId = inserted?.id as string | undefined;
        if (!newStaffId) {
            return internalError('Не удалось получить id сотрудника');
        }

        const invitation = await createPendingStaffInvitation(admin, {
            bizId,
            staffId: newStaffId,
            userId: body.user_id,
            invitedBy,
        });
        if (!invitation.ok || invitation.invitation.staff_id !== newStaffId) {
            // Without its own invitation the new card would be a stray copy: remove it. A concurrent
            // request that invited this person first keeps its card and invitation.
            await removeCard(admin, bizId, newStaffId);
        }
        if (!invitation.ok) {
            return internalError('Не удалось создать приглашение');
        }
        staffId = invitation.invitation.staff_id;
        invitationId = invitation.invitation.id;
        if (staffId === newStaffId) {
            // Only a new invitation is announced; a concurrent request's one was announced by it.
            await notifyNewStaffInvitation(admin, { bizId, branchId: body.branch_id, invitedUserId: body.user_id });
        }
    }

    await ensureStaffBranchAssignment({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    const scheduleResult = explicitSchedulingEnabled() ? { success: false, daysCreated: 0, error: undefined } : await initializeSchedule({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    const alreadyStaff = invitationId === null;
    return {
        ok: true,
        message: alreadyStaff ? STAFF_ALREADY_IN_TEAM_MESSAGE : STAFF_INVITATION_SENT_MESSAGE,
        data: {
            id: staffId,
            staff_id: staffId,
            invitation_id: invitationId,
            status: alreadyStaff ? 'already_staff' : 'pending',
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        },
    };
}

async function removeCard(admin: SupabaseClient, bizId: string, staffId: string): Promise<void> {
    const { error } = await admin.from('staff').delete().eq('id', staffId).eq('biz_id', bizId);
    if (error) {
        logWarn('StaffCreateFromUserService', 'Failed to remove the card of a failed invitation', {
            staffId,
            message: error.message,
        });
    }
}

async function ensureStaffBranchAssignment({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: SupabaseClient;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}): Promise<void> {
    if (!staffId) {
        return;
    }

    try {
        const todayISO = todayDateString();
        const { data: existingAssign } = await admin
            .from('staff_branch_assignments')
            .select('id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('branch_id', branchId)
            .is('valid_to', null)
            .maybeSingle();

        if (!existingAssign) {
            const { error } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: branchId,
                valid_from: todayISO,
            });
            if (error) {
                logWarn('StaffCreateFromUserService', 'Failed to create staff_branch_assignments row', {
                    message: error.message,
                });
            }
        }
    } catch (error) {
        logWarn('StaffCreateFromUserService', 'Unexpected error while creating staff_branch_assignments row', error);
    }
}

async function initializeSchedule({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: SupabaseClient;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}) {
    let scheduleResult: Awaited<ReturnType<typeof initializeStaffSchedule>> = {
        success: false,
        daysCreated: 0,
    };

    if (!staffId) {
        logWarn('StaffCreateFromUserService', 'No staff ID, cannot initialize schedule');
        return scheduleResult;
    }

    logDebug('StaffCreateFromUserService', 'Initializing schedule for new staff', {
        staffId,
        branchId,
    });

    try {
        scheduleResult = await initializeStaffSchedule(admin, bizId, staffId, branchId);
        logDebug('StaffCreateFromUserService', 'Schedule initialization completed', {
            staffId,
            result: scheduleResult,
        });
    } catch (scheduleError) {
        const errorMessage =
            scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
        logError('StaffCreateFromUserService', 'Schedule initialization failed', {
            staffId,
            error: errorMessage,
        });
        scheduleResult = {
            success: false,
            daysCreated: 0,
            error: errorMessage,
        };
    }

    return scheduleResult;
}
