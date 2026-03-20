import { decidePostSignInRedirect } from '@/app/auth/sign-in/redirect';

describe('decidePostSignInRedirect', () => {
    test('redirects to admin for super admins', async () => {
        const result = await decidePostSignInRedirect({
            fallback: '/',
            userId: 'user-1',
            fetchIsSuper: async () => true,
            fetchCurrentBusiness: async () => null,
            persistCurrentBusiness: jest.fn(),
            fetchOwnsBusiness: async () => false,
            hasActiveStaffRecord: async () => false,
            fetchMyRoles: async () => [],
        });

        expect(result).toBe('/admin');
    });

    test('redirects to dashboard and persists the only business when current business is not set', async () => {
        const persistCurrentBusiness = jest.fn();

        const result = await decidePostSignInRedirect({
            fallback: '/',
            userId: 'user-1',
            fetchIsSuper: async () => false,
            fetchCurrentBusiness: async () => ({
                ok: true,
                data: {
                    currentBizId: null,
                    businesses: [{ id: 'biz-1' }],
                },
            }),
            persistCurrentBusiness,
            fetchOwnsBusiness: async () => false,
            hasActiveStaffRecord: async () => false,
            fetchMyRoles: async () => [],
        });

        expect(result).toBe('/dashboard');
        expect(persistCurrentBusiness).toHaveBeenCalledWith('biz-1');
    });

    test('redirects to business selector when user has multiple businesses', async () => {
        const result = await decidePostSignInRedirect({
            fallback: '/',
            userId: 'user-1',
            fetchIsSuper: async () => false,
            fetchCurrentBusiness: async () => ({
                ok: true,
                data: {
                    currentBizId: 'biz-1',
                    businesses: [{ id: 'biz-1' }, { id: 'biz-2' }],
                },
            }),
            persistCurrentBusiness: jest.fn(),
            fetchOwnsBusiness: async () => false,
            hasActiveStaffRecord: async () => false,
            fetchMyRoles: async () => [],
        });

        expect(result).toBe('/select-business');
    });

    test('falls back to staff redirect when current-business lookup fails but staff record exists', async () => {
        const onCurrentBusinessError = jest.fn();

        const result = await decidePostSignInRedirect({
            fallback: '/',
            userId: 'user-1',
            fetchIsSuper: async () => false,
            fetchCurrentBusiness: async () => {
                throw new Error('network failed');
            },
            persistCurrentBusiness: jest.fn(),
            fetchOwnsBusiness: async () => false,
            hasActiveStaffRecord: async () => true,
            fetchMyRoles: async () => [],
            onCurrentBusinessError,
        });

        expect(result).toBe('/staff');
        expect(onCurrentBusinessError).toHaveBeenCalled();
    });
});
