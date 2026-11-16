import {
    canAssignBusinessRole,
    canChangeBusinessMember,
    loadBusinessMemberRoleKeys,
    parseBusinessMemberRoleKey,
    resolveBusinessMemberActor,
} from '@/lib/businessMemberRolePolicy';

describe('businessMemberRolePolicy', () => {
    describe('parseBusinessMemberRoleKey', () => {
        it('accepts only business role keys', () => {
            expect(parseBusinessMemberRoleKey('owner')).toBe('owner');
            expect(parseBusinessMemberRoleKey('staff')).toBe('staff');
            expect(parseBusinessMemberRoleKey('super_admin')).toBeNull();
            expect(parseBusinessMemberRoleKey('OWNER')).toBeNull();
            expect(parseBusinessMemberRoleKey(1)).toBeNull();
            expect(parseBusinessMemberRoleKey(undefined)).toBeNull();
        });
    });

    describe('canAssignBusinessRole', () => {
        it('lets only a super admin assign owner', () => {
            expect(canAssignBusinessRole('super_admin', 'owner')).toBe(true);
            expect(canAssignBusinessRole('owner', 'owner')).toBe(false);
            expect(canAssignBusinessRole('admin', 'owner')).toBe(false);
        });

        it('lets an owner but not an admin assign admin', () => {
            expect(canAssignBusinessRole('owner', 'admin')).toBe(true);
            expect(canAssignBusinessRole('admin', 'admin')).toBe(false);
        });

        it('lets every manager level assign lower roles', () => {
            for (const actor of ['super_admin', 'owner', 'admin'] as const) {
                expect(canAssignBusinessRole(actor, 'manager')).toBe(true);
                expect(canAssignBusinessRole(actor, 'staff')).toBe(true);
                expect(canAssignBusinessRole(actor, 'client')).toBe(true);
            }
        });
    });

    describe('canChangeBusinessMember', () => {
        it('protects owners from everyone except a super admin', () => {
            expect(canChangeBusinessMember('super_admin', ['owner'])).toBe(true);
            expect(canChangeBusinessMember('owner', ['owner', 'staff'])).toBe(false);
            expect(canChangeBusinessMember('admin', ['owner'])).toBe(false);
        });

        it('protects admins from other admins', () => {
            expect(canChangeBusinessMember('owner', ['admin'])).toBe(true);
            expect(canChangeBusinessMember('admin', ['admin'])).toBe(false);
        });

        it('allows changing lower members', () => {
            expect(canChangeBusinessMember('admin', ['manager', 'staff'])).toBe(true);
            expect(canChangeBusinessMember('admin', [])).toBe(true);
        });
    });

    describe('resolveBusinessMemberActor', () => {
        function clientWith(results: Record<string, boolean>) {
            const rpc = jest.fn(async (fn: string, args?: { p_role_key?: string }) => {
                const key = fn === 'has_role' ? `has_role:${args?.p_role_key}` : fn;
                return { data: results[key] ?? false, error: null };
            });
            return { rpc } as unknown as Parameters<typeof resolveBusinessMemberActor>[0];
        }

        it('returns the highest level the caller holds', async () => {
            await expect(resolveBusinessMemberActor(clientWith({ is_super_admin: true }), 'b')).resolves.toBe('super_admin');
            await expect(
                resolveBusinessMemberActor(clientWith({ 'has_role:owner': true, 'has_role:admin': true }), 'b'),
            ).resolves.toBe('owner');
            await expect(resolveBusinessMemberActor(clientWith({ 'has_role:admin': true }), 'b')).resolves.toBe('admin');
            await expect(resolveBusinessMemberActor(clientWith({}), 'b')).resolves.toBeNull();
        });
    });

    describe('loadBusinessMemberRoleKeys', () => {
        function serviceWith(userRoles: unknown[], roles: unknown[], failRoles = false) {
            const from = jest.fn((table: string) => {
                if (table === 'user_roles') {
                    const chain = {
                        select: () => chain,
                        eq: jest.fn(() => chain),
                        then: (resolve: (v: unknown) => unknown) => resolve({ data: userRoles, error: null }),
                    };
                    return chain;
                }
                return {
                    select: () => ({
                        in: async () => (failRoles ? { data: null, error: { message: 'x' } } : { data: roles, error: null }),
                    }),
                };
            });
            return { from } as unknown as Parameters<typeof loadBusinessMemberRoleKeys>[0];
        }

        it('maps role ids to keys', async () => {
            const result = await loadBusinessMemberRoleKeys(
                serviceWith([{ role_id: 'r1' }, { role_id: 'r2' }], [{ id: 'r1', key: 'owner' }, { id: 'r2', key: 'staff' }]),
                'b',
                'u',
            );
            expect(result).toEqual({ ok: true, keys: ['owner', 'staff'] });
        });

        it('returns no keys for a non-member and fails closed on errors', async () => {
            await expect(loadBusinessMemberRoleKeys(serviceWith([], []), 'b', 'u')).resolves.toEqual({ ok: true, keys: [] });
            await expect(
                loadBusinessMemberRoleKeys(serviceWith([{ role_id: 'r1' }], [], true), 'b', 'u'),
            ).resolves.toEqual({ ok: false });
        });
    });
});
