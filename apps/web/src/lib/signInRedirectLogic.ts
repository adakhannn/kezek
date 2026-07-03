import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';

export type CurrentBusinessState = {
    currentBizId: string | null;
    businesses: { id: string }[];
};
export type SignInRedirectDeps = {
    fetchIsSuper(): Promise<boolean>;
    fetchCurrentBusinessState(userId: string): Promise<CurrentBusinessState | null>;
    setCurrentBusiness?(bizId: string): Promise<void>;
    fetchOwnsBusiness(userId?: string): Promise<boolean>;
    fetchActiveStaff(userId?: string): Promise<boolean>;
    fetchMyRoles(): Promise<string[]>;
    warn?(message: string, details?: unknown): void;
};
export async function decideSignInRedirect(
    deps: SignInRedirectDeps,
    fallback: string,
    userId?: string,
): Promise<string> {
    // Для mobile OAuth callback нельзя заменять целевой путь ролевыми редиректами.
    if (fallback?.startsWith('/auth/callback-mobile')) {
        return fallback;
    }

    const safeFallback = sanitizeAuthReturnPath(fallback);

    if (await deps.fetchIsSuper()) {
        return '/admin';
    }
    if (userId) {
        try {
            const currentBusiness = await deps.fetchCurrentBusinessState(userId);
            if (currentBusiness) {
                const count = currentBusiness.businesses.length;
                if (count === 1) {
                    const only = currentBusiness.businesses[0];
                    if (
                        only?.id &&
                        currentBusiness.currentBizId !== only.id &&
                        deps.setCurrentBusiness
                    ) {
                        void deps.setCurrentBusiness(only.id).catch((error) => {
                            deps.warn?.('setCurrentBusiness failed', error);
                        });
                    }
                    return '/dashboard';
                }
                if (count > 1) {
                    return '/select-business';
                }
            }
        } catch (error) {
            deps.warn?.('fetchCurrentBusinessState failed', error);
        }
    }
    if (await deps.fetchOwnsBusiness(userId)) {
        return '/dashboard';
    }
    if (userId) {
        try {
            if (await deps.fetchActiveStaff(userId)) {
                return '/staff';
            }
        } catch (error) {
            deps.warn?.('fetchActiveStaff failed', error);
        }
    }
    const roles = await deps.fetchMyRoles();
    if (roles.includes('owner')) return '/dashboard';
    if (roles.includes('staff')) return '/staff';
    if (roles.some((role) => ['admin', 'manager'].includes(role))) return '/dashboard';
    return safeFallback;
}
