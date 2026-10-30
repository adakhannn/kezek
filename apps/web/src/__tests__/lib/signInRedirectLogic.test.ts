import { decideSignInRedirect, type SignInRedirectDeps } from '@/lib/signInRedirectLogic';
function createDeps(overrides: Partial<SignInRedirectDeps> = {}): SignInRedirectDeps {
    return {
        fetchIsSuper: jest.fn().mockResolvedValue(false),
        fetchCurrentBusinessState: jest.fn().mockResolvedValue(null),
        setCurrentBusiness: jest.fn().mockResolvedValue(undefined),
        fetchOwnsBusiness: jest.fn().mockResolvedValue(false),
        fetchActiveStaff: jest.fn().mockResolvedValue(false),
        fetchMyRoles: jest.fn().mockResolvedValue([]),
        warn: jest.fn(),
        ...overrides,
    };
}
describe('signInRedirectLogic', () => {
    test.each(['staff', 'owner', 'superadmin'])('preserves explicit booking destination for %s', async (role) => {
        const deps = createDeps({
            fetchIsSuper: jest.fn().mockResolvedValue(role === 'superadmin'),
            fetchOwnsBusiness: jest.fn().mockResolvedValue(role === 'owner'),
            fetchActiveStaff: jest.fn().mockResolvedValue(role === 'staff'),
        });
        const destination = '/b/test-business/booking?step=5&day=2026-10-12&service=1';
        await expect(decideSignInRedirect(deps, destination, 'user-1')).resolves.toBe(destination);
        expect(deps.fetchIsSuper).not.toHaveBeenCalled();
        expect(deps.fetchCurrentBusinessState).not.toHaveBeenCalled();
    });

    test('does not treat an unsafe fallback as an explicit destination', async () => {
        const deps = createDeps({ fetchActiveStaff: jest.fn().mockResolvedValue(true) });
        await expect(decideSignInRedirect(deps, '//evil.example/path', 'user-1')).resolves.toBe('/staff');
    });

    test('preserves the sanitized mobile callback path', async () => {
        const deps = createDeps();
        await expect(decideSignInRedirect(deps, '/auth/callback-mobile?state=1', 'user-1')).resolves.toBe('/auth/callback-mobile?state=1');
    });
    test('returns admin route for super admin', async () => {
        const deps = createDeps({
            fetchIsSuper: jest.fn().mockResolvedValue(true),
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/admin');
    });
    test('routes to dashboard for a single current business and syncs it when needed', async () => {
        const setCurrentBusiness = jest.fn().mockResolvedValue(undefined);
        const deps = createDeps({
            fetchCurrentBusinessState: jest.fn().mockResolvedValue({
                currentBizId: null,
                businesses: [{ id: 'biz-1' }],
            }),
            setCurrentBusiness,
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/dashboard');
        expect(setCurrentBusiness).toHaveBeenCalledWith('biz-1');
    });
    test('routes to business selector when multiple businesses are available', async () => {
        const deps = createDeps({
            fetchCurrentBusinessState: jest.fn().mockResolvedValue({
                currentBizId: 'biz-1',
                businesses: [{ id: 'biz-1' }, { id: 'biz-2' }],
            }),
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/select-business');
    });
    test('falls back to owner rule when current business state fails', async () => {
        const warn = jest.fn();
        const deps = createDeps({
            fetchCurrentBusinessState: jest.fn().mockRejectedValue(new Error('boom')),
            fetchOwnsBusiness: jest.fn().mockResolvedValue(true),
            warn,
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/dashboard');
        expect(warn).toHaveBeenCalled();
    });
    test('routes to staff area for active staff record', async () => {
        const deps = createDeps({
            fetchActiveStaff: jest.fn().mockResolvedValue(true),
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/staff');
    });
    test('uses role fallback when no direct ownership or staff record exists', async () => {
        const deps = createDeps({
            fetchMyRoles: jest.fn().mockResolvedValue(['manager']),
        });
        await expect(decideSignInRedirect(deps, '/', 'user-1')).resolves.toBe('/dashboard');
    });
    test('returns provided fallback when no rule matches', async () => {
        const deps = createDeps();
        await expect(decideSignInRedirect(deps, '/custom', 'user-1')).resolves.toBe('/custom');
    });

    test('sanitizes unsafe external fallback when no role rule matches', async () => {
        const deps = createDeps();
        await expect(
            decideSignInRedirect(deps, 'https://evil.example/after-login', 'user-1'),
        ).resolves.toBe('/');
    });
});
