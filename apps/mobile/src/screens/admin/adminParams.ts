/** The super-admin panel's screens (the website's /admin/*) and their route params. */
export type AdminBusinessParams = { bizId: string; bizName?: string };

export type AdminParamList = {
    /** /admin: platform counts, today's bookings, newest businesses and the sections. */
    AdminHome: undefined;
    /** /admin/businesses */
    AdminBusinesses: undefined;
    /** /admin/businesses/new: the manual creation path. */
    AdminBusinessNew: undefined;
    /** /admin/businesses/[id] */
    AdminBusiness: AdminBusinessParams;
    /** The profile form of /admin/businesses/[id] (name, address, contacts, categories, approval). */
    AdminBusinessEdit: AdminBusinessParams;
    /** /admin/businesses/[id]/branches */
    AdminBranches: AdminBusinessParams;
    /** /admin/businesses/[id]/branches/new (no branchId) and /[branchId]. */
    AdminBranchEdit: AdminBusinessParams & { branchId?: string };
    /** The working hours block of /admin/businesses/[id]/branches/[branchId]. */
    AdminBranchSchedule: AdminBusinessParams & { branchId: string; branchName?: string };
    /** /admin/businesses/[id]/members */
    AdminMembers: AdminBusinessParams;
    /** /admin/businesses/[id]/members/new */
    AdminMemberNew: AdminBusinessParams;
    /** /admin/businesses/[id]/owner */
    AdminOwner: AdminBusinessParams;
    /** /admin/business-applications */
    AdminBusinessApplications: undefined;
    /** /admin/role-applications */
    AdminRoleApplications: undefined;
    /** /admin/users */
    AdminUsers: undefined;
    /** /admin/users/[id] */
    AdminUser: { userId: string; userName?: string };
    /** /admin/roles */
    AdminRoles: undefined;
    /** /admin/roles/new (no roleId) and /admin/roles/[id]. */
    AdminRoleEdit: { roleId?: string };
    /** /admin/categories */
    AdminCategories: undefined;
    /** /admin/categories/new (no categoryId; `proposedName` from an application) and /[id]. */
    AdminCategoryEdit: { categoryId?: string; proposedName?: string };
};
