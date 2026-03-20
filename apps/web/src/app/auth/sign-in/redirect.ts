export type CurrentBusinessResponse = {
    ok: boolean;
    data?: {
        currentBizId: string | null;
        businesses: { id: string }[];
    };
};

type DecidePostSignInRedirectArgs = {
    fallback: string;
    userId?: string;
    fetchIsSuper: () => Promise<boolean>;
    fetchCurrentBusiness: () => Promise<CurrentBusinessResponse | null>;
    persistCurrentBusiness: (bizId: string) => Promise<void> | void;
    fetchOwnsBusiness: (userId?: string) => Promise<boolean>;
    hasActiveStaffRecord: (userId?: string) => Promise<boolean>;
    fetchMyRoles: () => Promise<string[]>;
    onCurrentBusinessError?: (error: unknown) => void;
    onStaffLookupError?: (error: unknown) => void;
};

export async function decidePostSignInRedirect({
    fallback,
    userId,
    fetchIsSuper,
    fetchCurrentBusiness,
    persistCurrentBusiness,
    fetchOwnsBusiness,
    hasActiveStaffRecord,
    fetchMyRoles,
    onCurrentBusinessError,
    onStaffLookupError,
}: DecidePostSignInRedirectArgs): Promise<string> {
    if (await fetchIsSuper()) return '/admin';

    if (userId) {
        try {
            const currentBusiness = await fetchCurrentBusiness();
            if (currentBusiness?.ok && currentBusiness.data) {
                const count = currentBusiness.data.businesses.length;
                if (count === 1) {
                    const only = currentBusiness.data.businesses[0];
                    if (only?.id && currentBusiness.data.currentBizId !== only.id) {
                        void Promise.resolve(persistCurrentBusiness(only.id)).catch(() => undefined);
                    }
                    return '/dashboard';
                }
                if (count > 1) return '/select-business';
            }
        } catch (error) {
            onCurrentBusinessError?.(error);
        }
    }

    if (await fetchOwnsBusiness(userId)) return '/dashboard';

    if (userId) {
        try {
            if (await hasActiveStaffRecord(userId)) return '/staff';
        } catch (error) {
            onStaffLookupError?.(error);
        }
    }

    const roles = await fetchMyRoles();
    if (roles.includes('owner')) return '/dashboard';
    if (roles.includes('staff')) return '/staff';
    if (roles.some((role) => ['admin', 'manager'].includes(role))) return '/dashboard';

    return fallback || '/';
}
