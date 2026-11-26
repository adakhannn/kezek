import type { Ionicons } from '@expo/vector-icons';

import type { MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import type { Business } from '../dashboard/types';

/** Management screens take the business they manage; the hub makes it current first. */
export type ManageRouteParams = { bizId: string; bizName?: string; tz?: string | null };

/** Routes of RootStackParamList whose params are exactly ManageRouteParams. */
export type ManageRoute = {
    [K in keyof RootStackParamList]: RootStackParamList[K] extends ManageRouteParams ? K : never;
}[keyof RootStackParamList];

export type ManageMenuItem = {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: MobileI18nKey;
    route: ManageRoute;
    /** Who sees the item (the website's rule for that page); all managing roles when absent. */
    roles?: NonNullable<Business['role']>[];
};

/**
 * The business management sections of the Business tab, in the website dashboard's order
 * (/dashboard/*). Each section adds its own entry here and registers its screens in
 * navigation/RootNavigatorScreens.tsx.
 */
export const MANAGE_MENU: ManageMenuItem[] = [
    // /dashboard/staff: every managing role (getBizContextForManagers).
    { key: 'staff', icon: 'people', label: 'manageStaff.menu.staff', route: 'ManageStaff' },
];

export function manageMenuFor(role: Business['role']): ManageMenuItem[] {
    return MANAGE_MENU.filter((item) => !item.roles || (role ? item.roles.includes(role) : false));
}
