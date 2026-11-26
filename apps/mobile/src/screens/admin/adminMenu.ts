import type { Ionicons } from '@expo/vector-icons';

import type { MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

/** Admin routes that open without params. */
export type AdminRoute = {
    [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never;
}[keyof RootStackParamList];

export type AdminMenuItem = {
    /** The website section in camelCase (/admin/system-health → 'systemHealth'). */
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: MobileI18nKey;
    route: AdminRoute;
};

/**
 * The super-admin sections of the app (the website's /admin/*), shown only to super admins. Each
 * area adds its own entries here and registers its screens in navigation/RootNavigatorScreens.tsx.
 */
export const ADMIN_MENU: AdminMenuItem[] = [
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
