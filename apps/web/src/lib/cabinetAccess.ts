/** Значение cookie выбранного кабинета. */
export type PreferredCabinet = 'admin' | 'dashboard' | 'staff' | 'cabinet';

const PREFERRED_TO_PATH: Record<PreferredCabinet, string> = {
    admin: '/admin',
    dashboard: '/dashboard',
    staff: '/staff',
    cabinet: '/cabinet',
};

export const PREFERRED_CABINET_COOKIE_NAME = 'kezek_preferred_cabinet';

export interface CabinetAccessProfile {
    isSuperAdmin: boolean;
    hasManagerRoles: boolean;
    hasStaff: boolean;
    canAdmin: boolean;
    canDashboard: boolean;
    canStaff: boolean;
    canCabinet: boolean;
    businesses: Array<{ id: string; role: 'owner' | 'admin' | 'manager' }>;
}

export type DefaultDashboardResult =
    | { path: '/admin' }
    | { path: '/dashboard' }
    | { path: '/select-business' }
    | { path: '/staff' }
    | { path: '/cabinet' };

export function resolveDefaultDashboard(
    profile: CabinetAccessProfile | null,
): DefaultDashboardResult {
    if (!profile) {
        return { path: '/cabinet' };
    }

    if (profile.isSuperAdmin) {
        return { path: '/admin' };
    }

    if (profile.hasManagerRoles) {
        return { path: '/dashboard' };
    }

    if (profile.hasStaff) {
        return { path: '/staff' };
    }

    return { path: '/cabinet' };
}

export function shouldRedirectToSelectBusiness(
    profile: CabinetAccessProfile,
    hasCurrentBusiness: boolean,
): boolean {
    if (!profile.hasManagerRoles) return false;
    if (hasCurrentBusiness) return false;
    return profile.businesses.length > 1;
}

export function countAvailableCabinetTypes(profile: CabinetAccessProfile): number {
    let n = 0;
    if (profile.canAdmin) n++;
    if (profile.canDashboard) n++;
    if (profile.canStaff) n++;
    if (profile.canCabinet) n++;
    return n;
}

export function getPathForPreferredCabinet(
    profile: CabinetAccessProfile,
    preferred: string | undefined,
): string | null {
    if (!preferred || !Object.keys(PREFERRED_TO_PATH).includes(preferred)) return null;
    const path = PREFERRED_TO_PATH[preferred as PreferredCabinet];
    if (path === '/admin' && !profile.canAdmin) return null;
    if (path === '/dashboard' && !profile.canDashboard) return null;
    if (path === '/staff' && !profile.canStaff) return null;
    if (path === '/cabinet' && !profile.canCabinet) return null;
    return path;
}

export function pathToPreferredCabinet(path: string): PreferredCabinet | null {
    const entry = Object.entries(PREFERRED_TO_PATH).find(([, p]) => p === path);
    return entry ? (entry[0] as PreferredCabinet) : null;
}
