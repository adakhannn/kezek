import { pickStaffCard } from '@core-domain/staff';
import { isUuid } from '@shared-client/validation';
import { cookies, headers } from 'next/headers';

import { BizAccessError, StaffSelectionRequiredError, type StaffOption } from './authDiagnostics';
import { createServiceRoleClientWithFallback } from './bizContextRuntimeHelpers';
import { logWarn } from './log';
import { resolveRequestAuthContext } from './requestAuthContext';
import { STAFF_SELECTION_COOKIE, STAFF_SELECTION_HEADER } from './staffSelection';
import { createSupabaseServerClient } from './supabaseHelpers';

export { StaffSelectionRequiredError } from './authDiagnostics';
export type { StaffOption } from './authDiagnostics';
export { STAFF_SELECTION_COOKIE, STAFF_SELECTION_HEADER } from './staffSelection';

type StaffRecord = {
    id: string;
    biz_id: string;
    branch_id: string | null;
    full_name?: string | null;
    is_active?: boolean;
    created_at?: string | null;
};

export type StaffContext = {
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    userId: string;
    staffId: string;
    bizId: string;
    branchId: string | null;
    /** Every active card of the caller (one per business), oldest first. */
    staffOptions: StaffOption[];
};

/**
 * Active staff cards of a user. A person can be an active master in several businesses (one card
 * per business), so this is a list: a single-row lookup failed for them (ARCH-02).
 */
export async function listActiveStaffRecords(
    supabase: Pick<StaffContext['supabase'], 'from'>,
    userId: string,
): Promise<StaffRecord[]> {
    const { data, error } = await supabase
        .from('staff')
        .select('id, biz_id, branch_id, full_name, is_active, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

    if (error) {
        logWarn('AuthBiz', 'Failed to list active staff cards', { message: error.message });
        throw new Error('STAFF_LOOKUP_FAILED');
    }
    return (data ?? []) as StaffRecord[];
}

/**
 * Which card the request acts as: an explicit card (request header, or a route that names the card)
 * must be one of the caller's active cards and is never replaced; then the only card; then the
 * remembered card; otherwise the caller has to choose (StaffSelectionRequiredError).
 */
function chooseStaffRecord(
    records: StaffRecord[],
    rawExplicit: string | null | undefined,
    rawRemembered: string | null | undefined,
): { record: StaffRecord; options: StaffOption[] } {
    const explicit = rawExplicit?.trim() || null;
    if (explicit && !isUuid(explicit)) throw new BizAccessError('NO_STAFF_ACCESS');
    const remembered = rawRemembered?.trim() || null;

    const pick = pickStaffCard(records, {
        explicitStaffId: explicit,
        preferredStaffId: remembered && isUuid(remembered) ? remembered : null,
    });
    const options = pick.options.map((row) => ({
        staffId: row.id,
        bizId: String(row.biz_id),
        branchId: row.branch_id ?? null,
    }));

    if (pick.status === 'none') throw new BizAccessError('NO_STAFF_RECORD');
    if (pick.status === 'forbidden') throw new BizAccessError('NO_STAFF_ACCESS');
    if (pick.status === 'selection_required') throw new StaffSelectionRequiredError(options);
    return { record: pick.record, options };
}

async function readRequestStaffSelection(): Promise<{ header: string | null; cookie: string | null }> {
    try {
        const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
        return {
            header: headerStore.get(STAFF_SELECTION_HEADER),
            cookie: cookieStore.get(STAFF_SELECTION_COOKIE)?.value ?? null,
        };
    } catch {
        // Outside a request scope (scripts, tests): nothing was chosen.
        return { header: null, cookie: null };
    }
}

async function ensureStaffRoleAssignment(params: {
    serviceClient: StaffContext['supabase'];
    userId: string;
    bizId: string;
}) {
    const { serviceClient, userId, bizId } = params;

    const { data: roleStaff } = await serviceClient
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle<{ id: string }>();

    if (!roleStaff?.id) {
        return;
    }

    const { data: existingRole } = await serviceClient
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleStaff.id)
        .eq('biz_id', bizId)
        .maybeSingle<{ id: string }>();

    if (existingRole) {
        return;
    }

    const { error } = await serviceClient
        .from('user_roles')
        .insert({
            user_id: userId,
            biz_id: bizId,
            role_id: roleStaff.id,
            // biz_key is GENERATED ALWAYS (coalesce(biz_id, nil uuid)); inserting it fails.
        });

    if (error) {
        logWarn('AuthBiz', 'Failed to auto-add staff role', { message: error.message });
    }
}

async function buildStaffContext(params: {
    supabase: StaffContext['supabase'];
    userId: string;
    scope: string;
    missingKeyMessage: string;
    explicitStaffId: string | null | undefined;
    rememberedStaffId: string | null | undefined;
}): Promise<StaffContext> {
    const { supabase, userId, scope } = params;
    const records = await listActiveStaffRecords(supabase, userId);
    const { record, options } = chooseStaffRecord(records, params.explicitStaffId, params.rememberedStaffId);

    const bizId = String(record.biz_id);
    const serviceClient = createServiceRoleClientWithFallback({
        scope,
        serverClient: supabase,
        missingKeyMessage: params.missingKeyMessage,
    });

    await ensureStaffRoleAssignment({
        serviceClient,
        userId,
        bizId,
    });

    return {
        supabase,
        userId,
        staffId: record.id,
        bizId,
        branchId: record.branch_id ?? null,
        staffOptions: options,
    };
}

/**
 * Staff context of a cabinet page (cookie session): the card from the request header, else the
 * remembered card (cookie), else the only card.
 */
export async function resolveStaffContext(): Promise<StaffContext> {
    const supabase = await createSupabaseServerClient();

    const {
        data: userData,
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }

    const selection = await readRequestStaffSelection();
    return buildStaffContext({
        supabase,
        userId: userData.user.id,
        scope: 'AuthBiz',
        missingKeyMessage: 'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS)',
        explicitStaffId: selection.header,
        rememberedStaffId: selection.cookie,
    });
}

/**
 * Staff context of an API request (cookie or mobile Bearer). The card is `selection.staffId` (a
 * route that names the card itself) or the X-Kezek-Staff-Id header; when both are given they must
 * agree. Without them: the remembered card of a cookie session, else the only card.
 */
export async function resolveStaffContextForRequest(
    req: Request,
    scope = 'AuthBiz',
    selection: { staffId?: string | null } = {},
): Promise<StaffContext> {
    const authContext = await resolveRequestAuthContext(req, scope);

    if (!('user' in authContext)) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }

    const header = req.headers.get(STAFF_SELECTION_HEADER)?.trim() || null;
    if (selection.staffId && header && selection.staffId !== header) {
        throw new BizAccessError('NO_STAFF_ACCESS');
    }
    const remembered = authContext.authSource === 'cookie' ? (await readRequestStaffSelection()).cookie : null;

    return buildStaffContext({
        supabase: authContext.supabase as StaffContext['supabase'],
        userId: authContext.user.id,
        scope,
        missingKeyMessage: 'SUPABASE_SERVICE_ROLE_KEY not set, using request client (RLS)',
        explicitStaffId: selection.staffId ?? header,
        rememberedStaffId: remembered,
    });
}
