import type { SupabaseClient } from '@supabase/supabase-js';

import { findAccountIdByConfirmedContact } from '@/lib/accountContactLookup';
import { logDebug, logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { createPendingStaffInvitation, findPendingStaffInvitation } from '@/lib/staffInvitationService';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { todayDateString } from '@/lib/time';

type StaffCreateInput = {
    supabase: SupabaseClient;
    admin: SupabaseClient;
    userId: string;
    bizId: string;
    body: {
        full_name: string;
        email?: string | null;
        phone?: string | null;
        branch_id: string;
        is_active: boolean;
    };
};

type StaffCreateFailure = {
    ok: false;
    status: 400 | 403 | 500;
    error: 'validation' | 'forbidden' | 'internal';
    message: string;
};

type StaffCreateSuccess = {
    ok: true;
    data: {
        id: string;
        schedule_initialized: boolean;
        schedule_days_created: number;
        schedule_error: string | null;
    };
};

type StaffCreateResult = StaffCreateFailure | StaffCreateSuccess;

export async function runStaffCreate({
    supabase,
    admin,
    userId,
    bizId,
    body,
}: StaffCreateInput): Promise<StaffCreateResult> {
    const hasAccess = await checkManagerRoleAccess({ supabase, userId, bizId });
    if (!hasAccess) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        };
    }

    if (!body.full_name || !body.branch_id) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Имя и филиал обязательны',
        };
    }

    // The card is never linked to an account here (API-06): a client session cannot set user_id
    // (staff_guard_client_write), and the account that confirmed this contact only gets an invitation.
    const { data, error } = await supabase
        .from('staff')
        .insert({
            biz_id: bizId,
            branch_id: body.branch_id,
            full_name: body.full_name,
            email: body.email ?? null,
            phone: body.phone ?? null,
            is_active: !!body.is_active,
            user_id: null,
        })
        .select('id')
        .single();

    if (error) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: error.message,
        };
    }

    const staffId = data?.id as string | undefined;
    await createInitialBranchAssignment({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    if (staffId) {
        await inviteAccountByContact({
            admin,
            bizId,
            staffId,
            invitedBy: userId,
            email: body.email,
            phone: body.phone,
        });
    }

    const scheduleResult = explicitSchedulingEnabled() ? { success: false, daysCreated: 0, error: undefined } : await initializeSchedule({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    if (!staffId) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось получить id сотрудника',
        };
    }

    return {
        ok: true,
        data: {
            id: staffId,
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        },
    };
}

async function checkManagerRoleAccess({
    supabase,
    userId,
    bizId,
}: {
    supabase: SupabaseClient;
    userId: string;
    bizId: string;
}) {
    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', userId)
        .eq('biz_id', bizId);

    const rolesArray = roles ?? [];
    return rolesArray.some((roleRow: unknown) => {
        if (!roleRow || typeof roleRow !== 'object' || !('roles' in roleRow)) return false;
        const role = roleRow.roles;
        if (!role || typeof role !== 'object' || !('key' in role)) return false;
        return typeof role.key === 'string' && ['owner', 'admin', 'manager'].includes(role.key);
    });
}

/**
 * Invites the one account that confirmed this e-mail or phone (ARCH-03) to the new card (API-06).
 * Silent by design: the response is the same whether an account exists or not, and a failed lookup or
 * insert only leaves the card without an invitation. An account that already has a card or a pending
 * invitation in this business is not invited again.
 */
async function inviteAccountByContact({
    admin,
    bizId,
    staffId,
    invitedBy,
    email,
    phone,
}: {
    admin: SupabaseClient;
    bizId: string;
    staffId: string;
    invitedBy: string;
    email?: string | null;
    phone?: string | null;
}): Promise<void> {
    if (!email && !phone) {
        return;
    }

    try {
        const accountId = await findAccountIdByConfirmedContact(admin, { email, phone });
        if (!accountId) return;

        const { data: ownCard, error: cardError } = await admin
            .from('staff')
            .select('id')
            .eq('biz_id', bizId)
            .eq('user_id', accountId)
            .limit(1)
            .maybeSingle();
        if (cardError || ownCard) return;

        const pending = await findPendingStaffInvitation(admin, bizId, accountId);
        if (!pending.ok || pending.invitation) return;

        const created = await createPendingStaffInvitation(admin, { bizId, staffId, userId: accountId, invitedBy });
        if (!created.ok) {
            logWarn('StaffCreateService', 'Failed to create a staff invitation');
        }
    } catch (error) {
        logWarn('StaffCreate', 'Account lookup by contact failed', error);
    }
}

async function createInitialBranchAssignment({
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
    try {
        const todayISO = todayDateString();
        const { error } = await admin.from('staff_branch_assignments').insert({
            biz_id: bizId,
            staff_id: staffId,
            branch_id: branchId,
            valid_from: todayISO,
        });
        if (error) {
            logWarn('StaffCreateService', 'Failed to create initial staff_branch_assignments row', {
                message: error.message,
            });
        }
    } catch (error) {
        logWarn('StaffCreateService', 'Unexpected error while creating staff_branch_assignments row', error);
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
        logWarn('StaffCreateService', 'No staff ID returned, cannot initialize schedule');
        return scheduleResult;
    }

    logDebug('StaffCreateService', 'Initializing schedule for new staff', {
        staffId,
        branchId,
    });

    try {
        scheduleResult = await initializeStaffSchedule(admin, bizId, staffId, branchId);
        logDebug('StaffCreateService', 'Schedule initialization completed', {
            staffId,
            result: scheduleResult,
        });
    } catch (scheduleError) {
        const errorMessage =
            scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
        logError('StaffCreateService', 'Schedule initialization failed', {
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
