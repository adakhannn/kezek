type SuperAdminRoleRow = {
    role_key: string;
    biz_id: string | null;
};

type SuperAdminRoleQuery = {
    eq: (column: string, value: string) => SuperAdminRoleQuery;
    is: (column: string, value: null) => SuperAdminRoleQuery;
    limit: (count: number) => SuperAdminRoleQuery;
    maybeSingle: () => Promise<{ data: SuperAdminRoleRow | null; error: unknown }>;
};

type SuperAdminRoleTable = {
    select: (columns: string) => SuperAdminRoleQuery;
};

export type SuperAdminRoleClient = {
    from: (table: string) => SuperAdminRoleTable;
};

export async function checkCurrentUserIsSuperAdmin(client: SuperAdminRoleClient, userId: string) {
    const { data, error } = await client
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('user_id', userId)
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    return { isSuperAdmin: !!data && !error, error };
}
