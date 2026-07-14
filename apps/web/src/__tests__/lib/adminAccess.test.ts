import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';

function createRoleClient(result: { data: unknown; error: unknown }) {
    const calls: Array<[string, unknown]> = [];
    const query = {
        select: jest.fn((columns: string) => {
            calls.push(['select', columns]);
            return query;
        }),
        eq: jest.fn((column: string, value: string) => {
            calls.push([`eq:${column}`, value]);
            return query;
        }),
        is: jest.fn((column: string, value: null) => {
            calls.push([`is:${column}`, value]);
            return query;
        }),
        limit: jest.fn((count: number) => {
            calls.push(['limit', count]);
            return query;
        }),
        maybeSingle: jest.fn().mockResolvedValue(result),
    };

    const client = {
        from: jest.fn((table: 'user_roles_with_user') => {
            calls.push(['from', table]);
            return query;
        }),
    } as SuperAdminRoleClient;

    return { client, calls };
}

describe('checkCurrentUserIsSuperAdmin', () => {
    test('scopes the super-admin lookup to the current user id', async () => {
        const { client, calls } = createRoleClient({
            data: { role_key: 'super_admin', biz_id: null },
            error: null,
        });

        const result = await checkCurrentUserIsSuperAdmin(client, 'current-user-id');

        expect(result.isSuperAdmin).toBe(true);
        expect(calls).toEqual([
            ['from', 'user_roles_with_user'],
            ['select', 'role_key,biz_id'],
            ['eq:user_id', 'current-user-id'],
            ['eq:role_key', 'super_admin'],
            ['is:biz_id', null],
            ['limit', 1],
        ]);
    });

    test('denies access when no role row exists for the current user', async () => {
        const { client } = createRoleClient({ data: null, error: null });

        const result = await checkCurrentUserIsSuperAdmin(client, 'current-user-id');

        expect(result.isSuperAdmin).toBe(false);
    });
});
