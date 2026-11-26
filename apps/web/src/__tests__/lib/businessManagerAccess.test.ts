import {
    BusinessAccessReadError,
    listBusinessManagerUserIds,
    listManagedBusinessRoles,
    managerAccessToBusiness,
} from '@/lib/businessManagerAccess';
import { listManagerPushRecipients } from '@/lib/notifications/managerPushRecipients';

type Result = { data: unknown; error: unknown };

/** An awaited query builder per table; filters are recorded so the tests can check the scope. */
function fakeAdmin(results: Record<string, Result>) {
    const calls: Array<{ table: string; filters: unknown[][] }> = [];
    const from = jest.fn((table: string) => {
        const call = { table, filters: [] as unknown[][] };
        calls.push(call);
        const builder: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'not', 'in']) {
            builder[method] = (...args: unknown[]) => { call.filters.push([method, ...args]); return builder; };
        }
        builder.maybeSingle = () => Promise.resolve(results[table] ?? { data: null, error: null });
        builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject);
        return builder;
    });
    return { admin: { from } as never, calls };
}

const ROLES = { data: [{ id: 1, key: 'owner' }, { id: 2, key: 'admin' }, { id: 3, key: 'manager' }, { id: 4, key: 'staff' }, { id: 5, key: 'client' }], error: null };

describe('listManagedBusinessRoles (O3/B10)', () => {
    test('owned businesses and owner/admin/manager roles count; staff and client roles do not', async () => {
        const { admin, calls } = fakeAdmin({
            businesses: { data: [{ id: 'biz-owned' }], error: null },
            user_roles: { data: [
                { biz_id: 'biz-admin', role_id: 2 }, { biz_id: 'biz-manager', role_id: 3 },
                { biz_id: 'biz-staff', role_id: 4 }, { biz_id: 'biz-client', role_id: 5 },
                { biz_id: 'biz-owned', role_id: 3 },
            ], error: null },
            roles: ROLES,
        });
        const roles = await listManagedBusinessRoles(admin, 'user-1');
        expect([...roles]).toEqual([['biz-owned', 'owner'], ['biz-admin', 'admin'], ['biz-manager', 'manager']]);
        expect(calls.find(call => call.table === 'businesses')!.filters).toContainEqual(['eq', 'owner_id', 'user-1']);
        expect(calls.find(call => call.table === 'user_roles')!.filters).toContainEqual(['eq', 'user_id', 'user-1']);
    });

    test('a failed read is an error, not "manages nothing"', async () => {
        const { admin } = fakeAdmin({ user_roles: { data: null, error: { message: 'down' } }, roles: ROLES });
        await expect(listManagedBusinessRoles(admin, 'user-1')).rejects.toBeInstanceOf(BusinessAccessReadError);
    });

    test('agrees with managerAccessToBusiness for an admin role', async () => {
        const { admin } = fakeAdmin({
            businesses: { data: { id: 'biz-admin', owner_id: 'someone-else' }, error: null },
            user_roles: { data: [{ role_id: 2 }], error: null },
            roles: ROLES,
        });
        await expect(managerAccessToBusiness(admin, 'user-1', 'biz-admin')).resolves.toBe('manager');
    });
});

describe('listBusinessManagerUserIds (O2)', () => {
    test('the owner plus every owner/admin/manager account of the business, once each', async () => {
        const { admin, calls } = fakeAdmin({
            user_roles: { data: [
                { user_id: 'owner-user', role_id: 1 }, { user_id: 'admin-user', role_id: 2 },
                { user_id: 'manager-user', role_id: 3 }, { user_id: 'staff-user', role_id: 4 }, { user_id: null, role_id: 3 },
            ], error: null },
            roles: ROLES,
        });
        await expect(listBusinessManagerUserIds(admin, 'biz-1', 'owner-user')).resolves.toEqual(['owner-user', 'admin-user', 'manager-user']);
        expect(calls.find(call => call.table === 'user_roles')!.filters).toContainEqual(['eq', 'biz_id', 'biz-1']);
    });

    test('a failed role read throws', async () => {
        const { admin } = fakeAdmin({ user_roles: { data: null, error: { message: 'down' } }, roles: ROLES });
        await expect(listBusinessManagerUserIds(admin, 'biz-1', 'owner-user')).rejects.toThrow('BUSINESS_ACCESS_READ_FAILED');
    });
});

describe('listManagerPushRecipients (O2)', () => {
    test('each manager with the language of their profile; unknown or missing profile is Russian', async () => {
        const { admin } = fakeAdmin({
            user_roles: { data: [{ user_id: 'manager-user', role_id: 3 }, { user_id: 'admin-user', role_id: 2 }], error: null },
            roles: ROLES,
            profiles: { data: [{ id: 'owner-user', preferred_locale: 'ky' }, { id: 'manager-user', preferred_locale: 'xx' }], error: null },
        });
        await expect(listManagerPushRecipients(admin, 'biz-1', 'owner-user')).resolves.toEqual([
            { userId: 'owner-user', locale: 'ky' }, { userId: 'manager-user', locale: 'ru' }, { userId: 'admin-user', locale: 'ru' },
        ]);
    });

    test('without a business id only the owner; without both, nothing is read', async () => {
        const owner = fakeAdmin({ profiles: { data: [], error: null } });
        await expect(listManagerPushRecipients(owner.admin, null, 'owner-user')).resolves.toEqual([{ userId: 'owner-user', locale: 'ru' }]);
        expect(owner.calls.map(call => call.table)).toEqual(['profiles']);
        const none = fakeAdmin({});
        await expect(listManagerPushRecipients(none.admin, null, null)).resolves.toEqual([]);
        expect(none.calls).toEqual([]);
    });

    test('a failed profile read fails the preparation', async () => {
        const { admin } = fakeAdmin({ user_roles: { data: [], error: null }, roles: ROLES, profiles: { data: null, error: { message: 'down' } } });
        await expect(listManagerPushRecipients(admin, 'biz-1', 'owner-user')).rejects.toThrow('MANAGER_PUSH_PROFILES_FAILED');
    });
});
