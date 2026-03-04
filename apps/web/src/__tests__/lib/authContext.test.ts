import type { UserRoleProfile } from '@/lib/authContext';
import {
    countAvailableCabinetTypes,
    getPathForPreferredCabinet,
    pathToPreferredCabinet,
    resolveDefaultDashboard,
    shouldRedirectToSelectBusiness,
} from '@/lib/authContext';

function makeProfile(overrides: Partial<UserRoleProfile> = {}): UserRoleProfile {
    return {
        userId: 'user-1',
        isSuperAdmin: false,
        hasOwnerBiz: false,
        hasManagerRoles: false,
        hasStaff: false,
        isClient: true,
        canAdmin: false,
        canDashboard: false,
        canStaff: false,
        canCabinet: true,
        businesses: [],
        ...overrides,
    };
}

describe('authContext', () => {
    describe('resolveDefaultDashboard', () => {
        it('returns /cabinet when profile is null', () => {
            expect(resolveDefaultDashboard(null)).toEqual({ path: '/cabinet' });
        });

        it('returns /admin when user is super admin', () => {
            const profile = makeProfile({ isSuperAdmin: true });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/admin' });
        });

        it('returns /dashboard when user has manager roles (owner)', () => {
            const profile = makeProfile({ hasOwnerBiz: true, hasManagerRoles: true });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/dashboard' });
        });

        it('returns /dashboard when user has manager roles (admin/manager only)', () => {
            const profile = makeProfile({ hasManagerRoles: true, hasOwnerBiz: false });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/dashboard' });
        });

        it('returns /staff when user has staff and no manager roles', () => {
            const profile = makeProfile({ hasStaff: true, hasManagerRoles: false });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/staff' });
        });

        it('prefers dashboard over staff when user has both', () => {
            const profile = makeProfile({ hasManagerRoles: true, hasStaff: true });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/dashboard' });
        });

        it('returns /cabinet for client-only profile', () => {
            const profile = makeProfile({
                isSuperAdmin: false,
                hasOwnerBiz: false,
                hasManagerRoles: false,
                hasStaff: false,
            });
            expect(resolveDefaultDashboard(profile)).toEqual({ path: '/cabinet' });
        });
    });

    describe('shouldRedirectToSelectBusiness', () => {
        it('returns false when user has no manager roles', () => {
            const profile = makeProfile({ hasManagerRoles: false, businesses: [{ id: 'b1', role: 'owner' }, { id: 'b2', role: 'owner' }] });
            expect(shouldRedirectToSelectBusiness(profile, false)).toBe(false);
        });

        it('returns false when user has current business selected', () => {
            const profile = makeProfile({ hasManagerRoles: true, businesses: [{ id: 'b1', role: 'owner' }, { id: 'b2', role: 'owner' }] });
            expect(shouldRedirectToSelectBusiness(profile, true)).toBe(false);
        });

        it('returns false when user has only one business', () => {
            const profile = makeProfile({ hasManagerRoles: true, businesses: [{ id: 'b1', role: 'owner' }] });
            expect(shouldRedirectToSelectBusiness(profile, false)).toBe(false);
        });

        it('returns true when user has multiple businesses and no current selection', () => {
            const profile = makeProfile({
                hasManagerRoles: true,
                businesses: [
                    { id: 'b1', role: 'owner' },
                    { id: 'b2', role: 'admin' },
                ],
            });
            expect(shouldRedirectToSelectBusiness(profile, false)).toBe(true);
        });
    });

    describe('countAvailableCabinetTypes', () => {
        it('counts only available cabinet types', () => {
            expect(countAvailableCabinetTypes(makeProfile({ canCabinet: true }))).toBe(1);
            expect(countAvailableCabinetTypes(makeProfile({ canDashboard: true, canCabinet: true }))).toBe(2);
            expect(countAvailableCabinetTypes(makeProfile({ canAdmin: true, canDashboard: true, canStaff: true, canCabinet: true }))).toBe(4);
        });
    });

    describe('getPathForPreferredCabinet', () => {
        it('returns path when preferred is allowed by profile', () => {
            const profile = makeProfile({ canDashboard: true, canCabinet: true });
            expect(getPathForPreferredCabinet(profile, 'dashboard')).toBe('/dashboard');
            expect(getPathForPreferredCabinet(profile, 'cabinet')).toBe('/cabinet');
        });

        it('returns null when preferred is not allowed by profile', () => {
            const profile = makeProfile({ canCabinet: true, canDashboard: false });
            expect(getPathForPreferredCabinet(profile, 'dashboard')).toBeNull();
            expect(getPathForPreferredCabinet(profile, 'admin')).toBeNull();
        });

        it('returns null for invalid or empty preferred', () => {
            const profile = makeProfile({ canAdmin: true });
            expect(getPathForPreferredCabinet(profile, '')).toBeNull();
            expect(getPathForPreferredCabinet(profile, undefined)).toBeNull();
            expect(getPathForPreferredCabinet(profile, 'invalid')).toBeNull();
        });
    });

    describe('pathToPreferredCabinet', () => {
        it('returns preferred value for known path', () => {
            expect(pathToPreferredCabinet('/admin')).toBe('admin');
            expect(pathToPreferredCabinet('/dashboard')).toBe('dashboard');
            expect(pathToPreferredCabinet('/staff')).toBe('staff');
            expect(pathToPreferredCabinet('/cabinet')).toBe('cabinet');
        });

        it('returns null for unknown path', () => {
            expect(pathToPreferredCabinet('/other')).toBeNull();
        });
    });
});
