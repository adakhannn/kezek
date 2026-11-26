import type { MobileI18nKey } from '../../../i18n';
import { apiRequest } from '../../../lib/api';

/*
 * Staff applications of the website (/dashboard/role-applications): GET and
 * POST /dashboard/api/role-applications[/id/status]. Approval creates the staff card and the
 * base schedule on the server; the screen only chooses the branch and whether to activate.
 */

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type RoleApplication = {
    id: string;
    applicant_user_id: string;
    requested_role: 'staff';
    status: ApplicationStatus;
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    message: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    prior_submission_count: number;
    risk_flags: string[];
    active_block_id: string | null;
};

export type ApplicationBranch = { id: string; name: string; address: string | null; is_active: boolean | null };

export type ApplicationAction = 'approve' | 'reject' | 'unblock';

export type DecisionResult = {
    ok: boolean;
    message?: string;
    staff_id?: string;
    schedule_initialized?: boolean;
    schedule_days_created?: number;
};

export async function fetchRoleApplications(): Promise<{ items: RoleApplication[]; branches: ApplicationBranch[] }> {
    const response = await apiRequest<{ ok?: boolean; items?: RoleApplication[]; branches?: ApplicationBranch[]; message?: string }>(
        '/dashboard/api/role-applications',
    );
    if (!response?.ok || !Array.isArray(response.items) || !Array.isArray(response.branches)) {
        throw new Error(response?.message || 'Unexpected applications response');
    }
    return { items: response.items, branches: response.branches };
}

/** The body of POST /dashboard/api/role-applications/[id]/status (the website's decide()). */
export function decisionBody(params: {
    action: ApplicationAction;
    note?: string;
    blockDays?: number;
    blockId?: string;
    branchId?: string;
    isActive?: boolean;
}) {
    const { action } = params;
    return {
        action,
        note: action === 'reject' ? params.note ?? '' : undefined,
        block_days: action === 'reject' ? params.blockDays ?? 0 : undefined,
        block_id: params.blockId,
        ...(action === 'approve' ? { branch_id: params.branchId, is_active: params.isActive ?? true } : {}),
    };
}

export async function decideApplication(id: string, body: ReturnType<typeof decisionBody>): Promise<DecisionResult> {
    const response = await apiRequest<DecisionResult>(`/dashboard/api/role-applications/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (!response?.ok) throw new Error(response?.message || 'Decision failed');
    return response;
}

/** What the history notice says (website ApplicationHistoryNotice); null when there is nothing to say. */
export function historyNotice(count: number, flags: string[]): { titleKey: MobileI18nKey; lines: MobileI18nKey[] } | null {
    const repeated = count > 0 || flags.includes('repeat_applicant') || flags.includes('high_submission_volume');
    const rejected = flags.includes('prior_rejection');
    const other = flags.some((flag) => !['repeat_applicant', 'high_submission_volume', 'prior_rejection'].includes(flag));
    if (!repeated && !rejected && !other) return null;
    const lines: MobileI18nKey[] = [];
    if (repeated) lines.push('ops.applications.history.scope');
    if (rejected) lines.push('ops.applications.history.rejected');
    if (other) lines.push('ops.applications.history.other');
    return { titleKey: repeated ? 'ops.applications.history.repeat' : 'ops.applications.history.title', lines };
}
