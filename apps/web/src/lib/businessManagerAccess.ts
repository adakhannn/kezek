import { MANAGER_ROLE_KEYS } from './userRoleProfile';

import type { DbTableClient } from '@/lib/supabaseTypes';

/** A read the access decision depends on failed; callers must not guess another business. */
export class BusinessAccessReadError extends Error {
    constructor(readonly step: string, readonly cause: unknown) {
        super(`BUSINESS_ACCESS_READ_FAILED: ${step}`);
        this.name = 'BusinessAccessReadError';
    }
}

type AdminLike = DbTableClient;

/**
 * The one rule for choosing (POST /api/me/current-business) and resolving (manager cabinet) the
 * current business (ARCH-06): the account owns it (businesses.owner_id) or holds an owner, admin or
 * manager role in it (user_roles). The setter and the resolver used different rules, so an owner
 * without a role row could select a business that the cabinet then refused.
 */
export async function managerAccessToBusiness(
    admin: AdminLike,
    userId: string,
    bizId: string,
): Promise<'manager' | 'none' | 'missing'> {
    const { data: business, error: businessError } = await admin
        .from('businesses')
        .select('id, owner_id')
        .eq('id', bizId)
        .maybeSingle();
    if (businessError) throw new BusinessAccessReadError('businesses', businessError);
    if (!business) return 'missing';
    if (business.owner_id === userId) return 'manager';

    const [{ data: roleRows, error: roleError }, { data: roleKeys, error: keyError }] = await Promise.all([
        admin.from('user_roles').select('role_id').eq('user_id', userId).eq('biz_id', bizId),
        admin.from('roles').select('id, key'),
    ]);
    if (roleError) throw new BusinessAccessReadError('user_roles', roleError);
    if (keyError) throw new BusinessAccessReadError('roles', keyError);

    const keyById = new Map<string, string>((roleKeys ?? []).map((role: { id: string | number; key: string }) => [String(role.id), String(role.key)]));
    const allowed = (roleRows ?? []).some((row: { role_id: string | number }) => MANAGER_ROLE_KEYS.has(keyById.get(String(row.role_id)) ?? ''));
    return allowed ? 'manager' : 'none';
}

async function managerRoleKeysById(admin: AdminLike): Promise<Map<string, string>> {
    const { data, error } = await admin.from('roles').select('id, key');
    if (error) throw new BusinessAccessReadError('roles', error);
    return new Map((data ?? [])
        .filter((role: { key: string }) => MANAGER_ROLE_KEYS.has(String(role.key)))
        .map((role: { id: string | number; key: string }) => [String(role.id), String(role.key)]));
}

/**
 * Every business `userId` manages, by the same rule as managerAccessToBusiness: owned
 * (businesses.owner_id, role 'owner') or held through an owner, admin or manager user_roles row.
 * Super admin is not a business role here: the platform admin works on the website.
 */
export async function listManagedBusinessRoles(
    admin: AdminLike,
    userId: string,
): Promise<Map<string, 'owner' | 'admin' | 'manager'>> {
    const [{ data: owned, error: ownedError }, { data: roleRows, error: roleError }, keyById] = await Promise.all([
        admin.from('businesses').select('id').eq('owner_id', userId),
        admin.from('user_roles').select('biz_id, role_id').eq('user_id', userId).not('biz_id', 'is', null),
        managerRoleKeysById(admin),
    ]);
    if (ownedError) throw new BusinessAccessReadError('businesses', ownedError);
    if (roleError) throw new BusinessAccessReadError('user_roles', roleError);

    const roles = new Map<string, 'owner' | 'admin' | 'manager'>();
    for (const row of owned ?? []) roles.set(String((row as { id: string }).id), 'owner');
    for (const row of (roleRows ?? []) as Array<{ biz_id: string | null; role_id: string | number }>) {
        const key = keyById.get(String(row.role_id));
        if (!row.biz_id || !key || roles.has(String(row.biz_id))) continue;
        roles.set(String(row.biz_id), key as 'owner' | 'admin' | 'manager');
    }
    return roles;
}

/**
 * The accounts that manage `bizId` (O2 push recipients): the owner plus every owner, admin or
 * manager user_roles row of the business. A failed read throws: an empty list would silently
 * drop the managers' notifications.
 */
export async function listBusinessManagerUserIds(
    admin: AdminLike,
    bizId: string,
    ownerId: string | null | undefined,
): Promise<string[]> {
    const [{ data: roleRows, error: roleError }, keyById] = await Promise.all([
        admin.from('user_roles').select('user_id, role_id').eq('biz_id', bizId),
        managerRoleKeysById(admin),
    ]);
    if (roleError) throw new BusinessAccessReadError('user_roles', roleError);
    const ids = new Set<string>(ownerId ? [ownerId] : []);
    for (const row of (roleRows ?? []) as Array<{ user_id: string | null; role_id: string | number }>) {
        if (row.user_id && keyById.has(String(row.role_id))) ids.add(String(row.user_id));
    }
    return [...ids];
}
