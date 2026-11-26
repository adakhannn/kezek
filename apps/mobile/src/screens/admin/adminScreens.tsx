import type { ComponentType } from 'react';

import type { MobileI18nKey } from '../../i18n';
import { withSessionGate } from '../../navigation/SessionGate';
import AdminBranchEditScreen from './AdminBranchEditScreen';
import AdminBranchesScreen from './AdminBranchesScreen';
import AdminBranchScheduleScreen from './AdminBranchScheduleScreen';
import AdminBusinessApplicationsScreen from './AdminBusinessApplicationsScreen';
import AdminBusinessEditScreen from './AdminBusinessEditScreen';
import AdminBusinessesScreen from './AdminBusinessesScreen';
import AdminBusinessNewScreen from './AdminBusinessNewScreen';
import AdminBusinessScreen from './AdminBusinessScreen';
import AdminCategoriesScreen from './AdminCategoriesScreen';
import AdminCategoryEditScreen from './AdminCategoryEditScreen';
import AdminHomeScreen from './AdminHomeScreen';
import AdminMemberNewScreen from './AdminMemberNewScreen';
import AdminMembersScreen from './AdminMembersScreen';
import AdminOwnerScreen from './AdminOwnerScreen';
import type { AdminParamList } from './adminParams';
import AdminRoleApplicationsScreen from './AdminRoleApplicationsScreen';
import AdminRoleEditScreen from './AdminRoleEditScreen';
import AdminRolesScreen from './AdminRolesScreen';
import { withAdminGuard } from './adminUi';
import AdminUserScreen from './AdminUserScreen';
import AdminUsersScreen from './AdminUsersScreen';

type AdminScreen = {
    name: keyof AdminParamList;
    // Each screen reads its own typed route; the registry only carries them to the navigator.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: ComponentType<any>;
    /** The header title; a function when it depends on the params (new or existing record). */
    title: MobileI18nKey | ((params: Record<string, unknown> | undefined) => MobileI18nKey);
};

/** Signed in and a global super admin (the server checks every request again). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const guard = (screen: ComponentType<any>) => withSessionGate(withAdminGuard(screen), 'workspace');

/** The super-admin panel's screens, registered in navigation/RootNavigatorScreens.tsx. */
export const ADMIN_SCREENS: AdminScreen[] = [
    { name: 'AdminHome', component: guard(AdminHomeScreen), title: 'admin.app.nav.home' },
    { name: 'AdminBusinesses', component: guard(AdminBusinessesScreen), title: 'admin.app.nav.businesses' },
    { name: 'AdminBusinessNew', component: guard(AdminBusinessNewScreen), title: 'admin.app.nav.businessNew' },
    { name: 'AdminBusiness', component: guard(AdminBusinessScreen), title: 'admin.app.nav.business' },
    { name: 'AdminBusinessEdit', component: guard(AdminBusinessEditScreen), title: 'admin.businessDetail.profile.title' },
    { name: 'AdminBranches', component: guard(AdminBranchesScreen), title: 'admin.branchesPage.title' },
    {
        name: 'AdminBranchEdit',
        component: guard(AdminBranchEditScreen),
        title: (params) => (params?.branchId ? 'admin.branchesPage.editTitle' : 'admin.branchesPage.newTitle'),
    },
    { name: 'AdminBranchSchedule', component: guard(AdminBranchScheduleScreen), title: 'catalog.branches.schedule.title' },
    { name: 'AdminMembers', component: guard(AdminMembersScreen), title: 'admin.membersPage.title' },
    { name: 'AdminMemberNew', component: guard(AdminMemberNewScreen), title: 'admin.membersPage.addMember' },
    { name: 'AdminOwner', component: guard(AdminOwnerScreen), title: 'admin.businesses.owner.title' },
    { name: 'AdminBusinessApplications', component: guard(AdminBusinessApplicationsScreen), title: 'admin.app.menu.businessApplications' },
    { name: 'AdminRoleApplications', component: guard(AdminRoleApplicationsScreen), title: 'admin.app.menu.roleApplications' },
    { name: 'AdminUsers', component: guard(AdminUsersScreen), title: 'admin.users.title' },
    { name: 'AdminUser', component: guard(AdminUserScreen), title: 'admin.users.user' },
    { name: 'AdminRoles', component: guard(AdminRolesScreen), title: 'admin.roles.title' },
    {
        name: 'AdminRoleEdit',
        component: guard(AdminRoleEditScreen),
        title: (params) => (params?.roleId ? 'admin.roles.role' : 'admin.roles.new.title'),
    },
    { name: 'AdminCategories', component: guard(AdminCategoriesScreen), title: 'admin.categories.title' },
    {
        name: 'AdminCategoryEdit',
        component: guard(AdminCategoryEditScreen),
        title: (params) => (params?.categoryId ? 'admin.categoryPages.editTitle' : 'admin.categoryPages.newTitle'),
    },
];

export function adminScreenTitle(screen: AdminScreen, params: Record<string, unknown> | undefined): MobileI18nKey {
    return typeof screen.title === 'function' ? screen.title(params) : screen.title;
}
