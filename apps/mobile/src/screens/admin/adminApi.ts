import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';

/**
 * The website's super-admin panel (/admin) API: the routes its pages call (apps/web/src/app/admin/api)
 * and the JSON reads of its server-rendered pages (lib/adminPanelHttpService.ts). Every route checks
 * on the server that the caller is a global super admin; the app sends its Bearer token.
 */

type Envelope = { ok?: boolean; error?: string; message?: string; code?: string };

/** A 2xx answer without ok: true is a failure too; its text is the server's. */
export class AdminCommandError extends Error {
    constructor(message: string, readonly details?: unknown) {
        super(message);
    }
}

function ensureOk<T extends Envelope>(response: T | null | undefined): T {
    if (!response || response.ok !== true) {
        throw new AdminCommandError(response?.message || response?.error || 'admin_request_failed', response);
    }
    return response;
}

const id = encodeURIComponent;
const post = (body?: unknown, method = 'POST'): RequestInit => ({
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function get<T extends Envelope>(path: string): Promise<T> {
    return ensureOk(await apiRequest<T>(path));
}

async function send<T extends Envelope = Envelope>(path: string, init: RequestInit): Promise<T> {
    return ensureOk(await apiRequest<T>(path, init));
}

/* ---------------------------------------------------------------- types */

export type HomeCountKey = 'businesses' | 'branches' | 'staff' | 'services' | 'bookings' | 'categories';

export type AdminTodayBooking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client: string;
    service: string;
    staff: string;
    biz: string;
    bizId: string | null;
    branch: string;
};

export type AdminHomeFailure =
    | { source: 'count'; count: HomeCountKey; message: string }
    | { source: 'latestBusinesses' | 'todayBookings'; message: string }
    | { source: 'unexpected'; message: string | null };

export type AdminOverview = {
    configured: boolean;
    checks: { serviceRoleKey: boolean; siteOrigin: boolean; supabaseKeys: boolean };
    day?: { label: string };
    counts?: Record<HomeCountKey, number>;
    latestBusinesses?: { id: string; name: string; slug: string; created_at: string }[];
    todayBookings?: AdminTodayBooking[];
    failures?: AdminHomeFailure[];
};

export type AdminBusinessListItem = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    created_at: string | null;
    is_approved: boolean | null;
    categories: string[] | null;
    address: string | null;
    owner_name: string | null;
    branches_count: number;
    staff_count: number;
};

export type AdminBusiness = {
    id: string;
    name: string;
    slug: string;
    categories: string[] | null;
    owner_id: string | null;
    is_approved: boolean | null;
    created_at: string | null;
    address: string | null;
    phones: string[] | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
    branch_limit: number;
};

export type AdminUserMini = { id: string; email: string | null; phone: string | null; full_name: string | null };

export type AdminBusinessDetail = {
    business: AdminBusiness;
    counts: { branches: number; staff: number; services: number; bookings: number };
    owner: AdminUserMini | null;
    categoryOptions: { slug: string; name: string }[];
};

export type AdminBranchListItem = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
    created_at: string | null;
};

export type AdminBranches = {
    business: { id: string; name: string; branch_limit: number };
    branches: AdminBranchListItem[];
};

export type TimeRange = { start: string; end: string };
export type ScheduleDay = { day_of_week: number; intervals: TimeRange[]; breaks: TimeRange[] };

export type AdminBranch = {
    id: string;
    biz_id: string;
    name: string;
    address: string | null;
    is_active: boolean;
    lat: number | null;
    lon: number | null;
    directory_links: Record<string, string | null>;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
    inherit_business_contacts: boolean | null;
};

export type AdminBranchDetail = { branch: AdminBranch; bizName: string | null; schedule: ScheduleDay[] };

export type MemberRoleKey = 'owner' | 'admin' | 'manager' | 'staff' | 'client';

export type AdminMember = {
    user_id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    roles: string[];
};

export type AdminCategory = { id: string; name_ru: string; slug: string; is_active: boolean; usage_count: number };

export type AdminRole = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
    created_at?: string | null;
};

export type AdminUserListItem = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    is_super: boolean;
    is_blocked: boolean;
    block_reason?: string | null;
};

export type UserStatusFilter = 'all' | 'active' | 'blocked';

export type AdminUserPage = { items: AdminUserListItem[]; page: number; perPage: number; total: number };

export type AdminUserStats = { total: number; active: number; blocked: number; super: number };

export type AdminUserRole = { role_key: string; biz_id: string | null; biz_name: string | null; biz_slug: string | null };

export type AdminUserDetail = {
    user: { id: string; email: string | null; phone: string | null; full_name: string | null; last_sign_in_at: string | null };
    isSuper: boolean;
    ownerBusinesses: { id: string; name: string; slug: string | null }[];
    roles: AdminUserRole[];
    suspension: { reason: string | null; created_at: string | null } | null;
};

export type AdminBusinessApplication = {
    id: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    business_name: string | null;
    category: string | null;
    comment: string | null;
    status: string | null;
    applicant_user_id: string | null;
    created_at: string;
    created_business_id: string | null;
    directory_links: Record<string, string | null> | null;
    prior_submission_count: number;
    risk_flags: string[];
};

export type AdminBusinessApplications = {
    applications: AdminBusinessApplication[];
    categoryNames: Record<string, string>;
};

export type RoleApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type RoleApplicationFilter = RoleApplicationStatus | 'all';
export type BusinessRoleKey = 'owner' | 'admin' | 'manager' | 'staff';

export type AdminRoleApplication = {
    id: string;
    applicant_user_id: string;
    biz_id: string;
    requested_role: BusinessRoleKey;
    status: RoleApplicationStatus;
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    message: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    evidence_links: Record<string, string | null>;
    prior_submission_count: number;
    risk_flags: string[];
    active_block_id: string | null;
    businesses: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
};

export type ManualBusinessInput = {
    name: string;
    slug: string;
    phone: string;
    categories: string[];
    branch_limit: number;
    reason: string;
    acknowledge_manual: boolean;
    duplicate_override: boolean;
};

export type BusinessDuplicate = {
    id: string;
    name: string;
    slug: string;
    phones: string[] | null;
    matchedBy: ('name' | 'phone')[];
};

/* ------------------------------------------------------------ requests */

const biz = (bizId: string) => `/admin/api/businesses/${id(bizId)}`;

export const adminApi = {
    overview: async (): Promise<AdminOverview> => get<Envelope & AdminOverview>('/admin/api/overview'),

    businesses: async () => (await get<Envelope & { items: AdminBusinessListItem[] }>('/admin/api/businesses/list')).items,
    business: async (bizId: string): Promise<AdminBusinessDetail> => get<Envelope & AdminBusinessDetail>(`${biz(bizId)}/detail`),
    createBusiness: async (input: ManualBusinessInput) =>
        (await send<Envelope & { id: string }>('/admin/api/businesses/create', post(input))).id,
    updateBusiness: (bizId: string, patch: Record<string, unknown>) => send(`${biz(bizId)}/update`, post(patch, 'PATCH')),
    setBranchLimit: (bizId: string, branchLimit: number) => send(`${biz(bizId)}/branch-limit`, post({ branch_limit: branchLimit })),
    deleteBusiness: (bizId: string) => send(`${biz(bizId)}/delete`, post()),

    branches: async (bizId: string): Promise<AdminBranches> => get<Envelope & AdminBranches>(`${biz(bizId)}/branches/list`),
    branch: async (bizId: string, branchId: string): Promise<AdminBranchDetail> =>
        get<Envelope & AdminBranchDetail>(`${biz(bizId)}/branches/${id(branchId)}/detail`),
    createBranch: (bizId: string, body: unknown) => send<Envelope & { id?: string }>(`${biz(bizId)}/branches/create`, post(body)),
    updateBranch: (bizId: string, branchId: string, body: unknown) => send(`${biz(bizId)}/branches/${id(branchId)}/update`, post(body)),
    deleteBranch: (bizId: string, branchId: string) => send(`${biz(bizId)}/branches/${id(branchId)}/delete`, post()),
    saveBranchSchedule: (bizId: string, branchId: string, schedule: ScheduleDay[]) =>
        send(`${biz(bizId)}/branches/${id(branchId)}/schedule`, post({ schedule })),

    members: async (bizId: string) => (await get<Envelope & { items: AdminMember[] }>(`${biz(bizId)}/members/list`)).items,
    grantRole: (bizId: string, userId: string, role: MemberRoleKey) =>
        send(`${biz(bizId)}/members/grant`, post({ user_id: userId, role_key: role })),
    revokeRole: (bizId: string, userId: string, role: MemberRoleKey) =>
        send(`${biz(bizId)}/members/revoke`, post({ user_id: userId, role_key: role })),
    demoteMember: (bizId: string, userId: string) => send(`${biz(bizId)}/members/demote`, post({ user_id: userId })),

    owners: async (bizId: string) => (await get<Envelope & { owners: AdminUserMini[] }>(`${biz(bizId)}/owner/list`)).owners,
    saveOwners: (bizId: string, userIds: string[]) => send(`${biz(bizId)}/owner/save`, post({ user_ids: userIds })),

    searchUsers: async (query: string) => {
        const q = query.trim();
        return (await get<Envelope & { items: AdminUserMini[] }>(`/admin/api/users/search${q ? `?q=${id(q)}` : ''}`)).items;
    },

    users: async (params: { q: string; page: number; perPage: number; status: UserStatusFilter }): Promise<AdminUserPage> => {
        const query = new URLSearchParams({ q: params.q.trim(), page: String(params.page), perPage: String(params.perPage), status: params.status });
        return get<Envelope & AdminUserPage>(`/admin/api/users/list?${query.toString()}`);
    },
    userStats: async () => (await get<Envelope & { stats: AdminUserStats }>('/admin/api/users/stats')).stats,
    user: async (userId: string): Promise<AdminUserDetail> => get<Envelope & AdminUserDetail>(`/admin/api/users/${id(userId)}/detail`),
    updateUser: (userId: string, body: { full_name: string; email: string | null; phone: string | null }) =>
        send(`/admin/api/users/${id(userId)}/update-basic`, post(body)),
    toggleSuper: async (userId: string, makeSuper: boolean) =>
        (await send<Envelope & { data?: { isSuperAdmin?: boolean } }>(`/admin/api/users/${id(userId)}/toggle-super`, post({ makeSuper }))).data,
    sendMagicLink: async (userId: string) =>
        (await send<Envelope & { link?: string | null }>(`/admin/api/users/${id(userId)}/send-magic-link`, post())).link ?? null,
    setBlocked: async (userId: string, block: boolean) =>
        (await send<Envelope & { blocked?: boolean }>(`/admin/api/users/${id(userId)}/suspend`, post({ block }))).blocked,
    deleteUser: (userId: string) => send(`/admin/api/users/${id(userId)}/delete`, post()),

    roles: async () => (await get<Envelope & { items: AdminRole[] }>('/admin/api/roles/list')).items,
    createRole: (body: { key: string; name: string; description: string | null }) => send('/admin/api/roles/create', post(body)),
    updateRole: (roleId: string, body: { name: string; description: string | null }) =>
        send(`/admin/api/roles/${id(roleId)}/update`, post(body)),
    deleteRole: (roleId: string) => send(`/admin/api/roles/${id(roleId)}/delete`, post()),

    categories: async () => (await get<Envelope & { items: AdminCategory[] }>('/admin/api/categories/list')).items,
    createCategory: (body: { name_ru: string; slug: string | null; is_active: boolean }) =>
        send('/admin/api/categories/create', post(body)),
    updateCategory: (categoryId: string, body: { name_ru: string | null; slug: string | null; is_active: boolean }) =>
        send(`/admin/api/categories/${id(categoryId)}/update`, post({ ...body, propagateSlug: true })),
    deleteCategory: (categoryId: string, force: boolean) => send(`/admin/api/categories/${id(categoryId)}/delete`, post({ force })),

    businessApplications: async (): Promise<AdminBusinessApplications> =>
        get<Envelope & AdminBusinessApplications>('/admin/api/business-applications'),
    setBusinessApplicationStatus: (applicationId: string, body: { status: 'approved' | 'rejected' | 'contacted'; note?: string; block_days?: number }) =>
        send<Envelope & { businessId?: string }>(`/admin/api/business-applications/${id(applicationId)}/status`, post(body)),

    roleApplications: async (status: RoleApplicationFilter) =>
        (await get<Envelope & { items: AdminRoleApplication[] }>(`/admin/api/role-applications?status=${id(status)}`)).items,
    decideRoleApplication: (applicationId: string, body: { action: 'approve' | 'reject' | 'unblock'; note?: string; block_days?: number; block_id?: string }) =>
        send(`/admin/api/role-applications/${id(applicationId)}/status`, post(body)),
};

/**
 * Who may grant and revoke roles on the members page: the website lets only the owner or an admin
 * of that business manage (the super admin views); the same SQL check, under the app's session.
 */
export async function canManageMembers(bizId: string): Promise<boolean> {
    const [owner, admin] = await Promise.all([
        supabase.rpc('has_role', { p_role_key: 'owner', p_biz_id: bizId }),
        supabase.rpc('has_role', { p_role_key: 'admin', p_biz_id: bizId }),
    ]);
    if (owner.error) throw owner.error;
    if (admin.error) throw admin.error;
    return owner.data === true || admin.data === true;
}

/** react-query keys; everything starts with 'admin', so a write can refresh the whole panel. */
export const adminKeys = {
    all: ['admin'] as const,
    overview: ['admin', 'overview'] as const,
    businesses: ['admin', 'businesses'] as const,
    business: (bizId: string) => ['admin', 'business', bizId] as const,
    branches: (bizId: string) => ['admin', 'business', bizId, 'branches'] as const,
    branch: (bizId: string, branchId: string) => ['admin', 'business', bizId, 'branch', branchId] as const,
    members: (bizId: string) => ['admin', 'business', bizId, 'members'] as const,
    canManageMembers: (bizId: string) => ['admin', 'business', bizId, 'canManageMembers'] as const,
    owners: (bizId: string) => ['admin', 'business', bizId, 'owners'] as const,
    userSearch: (query: string) => ['admin', 'userSearch', query] as const,
    users: (q: string, page: number, perPage: number, status: UserStatusFilter) => ['admin', 'users', q, page, perPage, status] as const,
    userStats: ['admin', 'userStats'] as const,
    user: (userId: string) => ['admin', 'user', userId] as const,
    roles: ['admin', 'roles'] as const,
    categories: ['admin', 'categories'] as const,
    businessApplications: ['admin', 'businessApplications'] as const,
    roleApplications: (status: RoleApplicationFilter) => ['admin', 'roleApplications', status] as const,
};
