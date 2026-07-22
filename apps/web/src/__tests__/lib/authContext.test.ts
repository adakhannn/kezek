import type { UserRoleProfile } from '@/lib/authContext';
import {
    countAvailableCabinetTypes,
    getUserRoleProfile,
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
    describe('getUserRoleProfile', () => {
        function createSupabaseMock(overrides: Partial<{
            userId: string | null;
            isSuperAdmin: boolean;
            roleKeys: string[];
            ownedCount: number;
            staffRow: { id: string } | null;
            ownedBusinesses: Array<{ id: string }>;
            userRolesRows: Array<{ biz_id: string; role_id: string }>;
            roles: Array<{ id: string; key: string }>;
        }> = {}) {
            const config = {
                userId: 'user-1',
                isSuperAdmin: false,
                roleKeys: [] as string[],
                ownedCount: 0,
                staffRow: null as { id: string } | null,
                ownedBusinesses: [] as Array<{ id: string }>,
                userRolesRows: [] as Array<{ biz_id: string; role_id: string }>,
                roles: [] as Array<{ id: string; key: string }>,
                ...overrides,
            };

            const businessesCountQuery = {
                select: jest.fn(),
                eq: jest.fn(),
            };
            businessesCountQuery.select.mockReturnValue(businessesCountQuery);
            businessesCountQuery.eq.mockResolvedValue({
                count: config.ownedCount,
            });

            const staffQuery = {
                select: jest.fn(),
                eq: jest.fn(),
                maybeSingle: jest.fn(),
            };
            staffQuery.select.mockReturnValue(staffQuery);
            staffQuery.eq.mockReturnValue(staffQuery);
            staffQuery.maybeSingle.mockResolvedValue({
                data: config.staffRow,
            });

            const ownedBusinessesQuery = {
                select: jest.fn(),
                eq: jest.fn(),
            };
            ownedBusinessesQuery.select.mockReturnValue(ownedBusinessesQuery);
            ownedBusinessesQuery.eq.mockResolvedValue({
                data: config.ownedBusinesses,
            });

            const userRolesQuery = {
                select: jest.fn(),
                eq: jest.fn(),
                not: jest.fn(),
            };
            userRolesQuery.select.mockReturnValue(userRolesQuery);
            userRolesQuery.eq.mockReturnValue(userRolesQuery);
            userRolesQuery.not.mockResolvedValue({
                data: config.userRolesRows,
            });

            const rolesQuery = {
                select: jest.fn(),
                in: jest.fn(),
            };
            rolesQuery.select.mockReturnValue(rolesQuery);
            rolesQuery.in.mockResolvedValue({
                data: config.roles,
            });

            const from = jest.fn((table: string) => {
                if (table === 'businesses') {
                    const next = from.mock.calls.filter(([name]) => name === 'businesses').length;
                    return next === 1 ? businessesCountQuery : ownedBusinessesQuery;
                }
                if (table === 'staff') {
                    return staffQuery;
                }
                if (table === 'user_roles') {
                    return userRolesQuery;
                }
                if (table === 'roles') {
                    return rolesQuery;
                }
                throw new Error(`Unexpected table ${table}`);
            });

            const rpc = jest.fn((name: string) => {
                if (name === 'is_super_admin') {
                    return Promise.resolve({ data: config.isSuperAdmin });
                }
                if (name === 'my_role_keys') {
                    return Promise.resolve({ data: config.roleKeys });
                }
                throw new Error(`Unexpected rpc ${name}`);
            });

            return {
                auth: {
                    getUser: jest.fn().mockResolvedValue({
                        data: {
                            user: config.userId ? { id: config.userId } : null,
                        },
                    }),
                },
                from,
                rpc,
            };
        }

        it('returns null when user is not authorized', async () => {
            const supabase = createSupabaseMock({ userId: null });

            await expect(getUserRoleProfile(supabase as never)).resolves.toBeNull();
        });

        it('builds owner-manager profile with owned businesses', async () => {
            const supabase = createSupabaseMock({
                ownedCount: 2,
                ownedBusinesses: [{ id: 'biz-1' }, { id: 'biz-2' }],
                roleKeys: ['owner'],
            });

            const profile = await getUserRoleProfile(supabase as never);

            expect(profile).toMatchObject({
                userId: 'user-1',
                hasOwnerBiz: true,
                hasManagerRoles: true,
                hasStaff: false,
                canDashboard: true,
                canStaff: false,
            });
            expect(profile?.businesses).toEqual([
                { id: 'biz-1', role: 'owner' },
                { id: 'biz-2', role: 'owner' },
            ]);
        });

        it('includes manager businesses from user_roles and roles lookup', async () => {
            const supabase = createSupabaseMock({
                roleKeys: ['manager'],
                userRolesRows: [
                    { biz_id: 'biz-3', role_id: 'role-manager' },
                    { biz_id: 'biz-4', role_id: 'role-staff' },
                    { biz_id: 'biz-3', role_id: 'role-manager' },
                ],
                roles: [
                    { id: 'role-manager', key: 'manager' },
                    { id: 'role-staff', key: 'staff' },
                ],
            });

            const profile = await getUserRoleProfile(supabase as never);

            expect(profile?.hasManagerRoles).toBe(true);
            expect(profile?.businesses).toEqual([{ id: 'biz-3', role: 'manager' }]);
        });

        it('derives staff access from staff record or staff role key', async () => {
            const fromRecord = await getUserRoleProfile(
                createSupabaseMock({
                    staffRow: { id: 'staff-1' },
                }) as never,
            );
            const fromRole = await getUserRoleProfile(
                createSupabaseMock({
                    roleKeys: ['staff'],
                }) as never,
            );

            expect(fromRecord).toMatchObject({ hasStaff: true, canStaff: true });
            expect(fromRole).toMatchObject({ hasStaff: true, canStaff: true });
        });

        it('does not grant the business dashboard to a super admin', async () => {
            const supabase = createSupabaseMock({
                isSuperAdmin: true,
                roleKeys: ['manager'],
                userRolesRows: [{ biz_id: 'biz-5', role_id: 'role-manager' }],
                roles: [{ id: 'role-manager', key: 'manager' }],
            });

            const profile = await getUserRoleProfile(supabase as never);

            expect(profile).toMatchObject({
                isSuperAdmin: true,
                canAdmin: true,
                hasManagerRoles: false,
                canDashboard: false,
            });
            expect(profile?.businesses).toEqual([]);
        });
    });

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
