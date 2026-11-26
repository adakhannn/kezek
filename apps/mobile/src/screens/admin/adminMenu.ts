import type { Ionicons } from '@expo/vector-icons';

import type { MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

/** Admin routes that open without parameters (a section's first screen). */
export type AdminRoute = {
    [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? (K extends `Admin${string}` ? K : never) : never;
}[keyof RootStackParamList];

export type AdminMenuItem = {
    /** The website section in camelCase (/admin/role-applications → 'roleApplications'). */
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: MobileI18nKey;
    route: AdminRoute;
};

/**
 * The sections of the super-admin panel (the website's /admin navigation), shown as tiles on the
 * AdminHome screen. A section adds its entry here and registers its screens in
 * navigation/RootNavigatorScreens.tsx (see adminScreens.tsx).
 */
export const ADMIN_MENU: AdminMenuItem[] = [
    { key: 'businesses', icon: 'storefront', label: 'admin.app.menu.businesses', route: 'AdminBusinesses' },
    { key: 'businessApplications', icon: 'document-text', label: 'admin.app.menu.businessApplications', route: 'AdminBusinessApplications' },
    { key: 'roleApplications', icon: 'person-add', label: 'admin.app.menu.roleApplications', route: 'AdminRoleApplications' },
    { key: 'users', icon: 'people', label: 'admin.app.menu.users', route: 'AdminUsers' },
    { key: 'roles', icon: 'key', label: 'admin.app.menu.roles', route: 'AdminRoles' },
    { key: 'categories', icon: 'pricetags', label: 'admin.app.menu.categories', route: 'AdminCategories' },
];
