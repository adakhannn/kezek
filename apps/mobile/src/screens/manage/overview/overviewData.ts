import type { MobileI18nKey } from '../../../i18n';
import { apiRequest } from '../../../lib/api';

/*
 * The business dashboard home of the website (/dashboard): GET /api/dashboard/overview gives the
 * same numbers the page renders (lib/dashboardHomeData.ts); the cards and the focus are chosen
 * here by the website's rules (dashboardHomeViewModel).
 */

export type DashboardOverview = {
    staffApplications: { pending: number | null } | null;
    bizName: string | null;
    bizCity: string | null;
    formattedDate: string;
    timezone: string;
    bookingsToday: number;
    staffActive: number;
    servicesActive: number;
    branchesCount: number;
    needOnboarding: boolean;
    ratingScore: number | null;
    ratingConfigScope: 'biz' | 'global' | null;
    ratingWeights: { reviews: number; productivity: number; loyalty: number; discipline: number; windowDays: number } | null;
};

/** A website section the home links to; the app opens its screen, or the website without one. */
export type DashboardSection = 'bookings' | 'staff' | 'staffNew' | 'services' | 'servicesNew' | 'branches' | 'roleApplications';

export async function fetchOverview(): Promise<DashboardOverview> {
    const response = await apiRequest<{ ok?: boolean; data?: DashboardOverview }>('/api/dashboard/overview');
    if (!response?.ok || !response.data || typeof response.data.bookingsToday !== 'number') {
        throw new Error('Unexpected overview response');
    }
    return response.data;
}

/** The setup steps still missing, in the website's order. */
export function onboardingItems(data: Pick<DashboardOverview, 'branchesCount' | 'servicesActive' | 'staffActive' | 'bookingsToday'>): MobileI18nKey[] {
    const items: MobileI18nKey[] = [];
    if (data.branchesCount === 0) items.push('ops.home.onboarding.noBranches');
    if (data.servicesActive === 0) items.push('ops.home.onboarding.noServices');
    if (data.staffActive === 0) items.push('ops.home.onboarding.noStaff');
    if (data.bookingsToday === 0) items.push('ops.home.onboarding.noBookings');
    return items;
}

export type HomeFocus = {
    kind: 'applications' | 'setup' | 'today' | 'growth';
    titleKey: MobileI18nKey;
    descriptionKey: MobileI18nKey;
    ctaKey: MobileI18nKey;
    section: DashboardSection;
    tone: 'warning' | 'info' | 'success';
    /** Pending applications, shown with the title. */
    count?: number;
};

/** The main focus of the day (the website's primaryFocus). */
export function homeFocus(data: DashboardOverview): HomeFocus {
    const pending = data.staffApplications?.pending;
    if (pending != null && pending > 0) {
        return {
            kind: 'applications', titleKey: 'ops.home.applications.title', descriptionKey: 'ops.home.applications.pending',
            ctaKey: 'ops.home.applications.review', section: 'roleApplications', tone: 'info', count: pending,
        };
    }
    if (data.needOnboarding) {
        const missing = onboardingItems(data);
        return {
            kind: 'setup',
            titleKey: 'ops.home.focus.setupTitle',
            descriptionKey: missing[0] ?? 'ops.home.focus.setupDesc',
            ctaKey: 'ops.home.focus.setupCta',
            section: data.branchesCount === 0 ? 'branches' : data.servicesActive === 0 ? 'services' : data.staffActive === 0 ? 'staff' : 'bookings',
            tone: 'warning',
        };
    }
    if (data.bookingsToday > 0) {
        return {
            kind: 'today', titleKey: 'ops.home.focus.todayTitle', descriptionKey: 'ops.home.focus.todayDesc',
            ctaKey: 'ops.home.focus.todayCta', section: 'bookings', tone: 'info',
        };
    }
    return {
        kind: 'growth', titleKey: 'ops.home.focus.growthTitle', descriptionKey: 'ops.home.focus.growthDesc',
        ctaKey: 'ops.home.focus.growthCta', section: 'services', tone: 'success',
    };
}

/** The website path of a section, for the sections the app has no screen of yet. */
export const SECTION_WEB_PATH: Record<DashboardSection, string> = {
    bookings: '/dashboard/bookings',
    staff: '/dashboard/staff',
    staffNew: '/dashboard/staff/new',
    services: '/dashboard/services',
    servicesNew: '/dashboard/services/new',
    branches: '/dashboard/branches',
    roleApplications: '/dashboard/role-applications',
};
