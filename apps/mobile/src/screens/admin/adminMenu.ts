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
    // Analytics: /admin/analytics/*, /admin/analytics/system, /admin/funnel-analytics.
    { key: 'analytics', icon: 'stats-chart', label: 'adminOps.nav.analytics', route: 'AdminAnalytics' },
    { key: 'systemAnalytics', icon: 'globe', label: 'adminOps.nav.systemAnalytics', route: 'AdminSystemAnalytics' },
    { key: 'funnelAnalytics', icon: 'funnel', label: 'adminOps.nav.funnelAnalytics', route: 'AdminFunnelAnalytics' },
    // Ratings: /admin/rating-config, /admin/ratings-status, /admin/ratings-debug.
    { key: 'ratingConfig', icon: 'options', label: 'adminOps.nav.ratingConfig', route: 'AdminRatingConfig' },
    { key: 'ratingsStatus', icon: 'star-half', label: 'adminOps.nav.ratingsStatus', route: 'AdminRatingsStatus' },
    { key: 'ratingsDebug', icon: 'bug', label: 'adminOps.nav.ratingsDebug', route: 'AdminRatingsDebug' },
    { key: 'promotionsDebug', icon: 'pricetags', label: 'adminOps.nav.promotionsDebug', route: 'AdminPromotionsDebug' },
    // Monitoring and diagnostics: /admin/system-health, /admin/health-check, /admin/monitoring, /admin/performance.
    { key: 'systemHealth', icon: 'heart', label: 'adminOps.nav.systemHealth', route: 'AdminSystemHealth' },
    { key: 'healthCheck', icon: 'medkit', label: 'adminOps.nav.healthCheck', route: 'AdminHealthCheck' },
    { key: 'monitoring', icon: 'pulse', label: 'adminOps.nav.monitoring', route: 'AdminMonitoring' },
    { key: 'performance', icon: 'speedometer', label: 'adminOps.nav.performance', route: 'AdminPerformance' },
];
