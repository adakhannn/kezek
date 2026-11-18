import { MANAGER_ROLE_KEYS } from './userRoleProfile';

/** A read the access decision depends on failed; callers must not guess another business. */
export class BusinessAccessReadError extends Error {
    constructor(readonly step: string, readonly cause: unknown) {
        super(`BUSINESS_ACCESS_READ_FAILED: ${step}`);
        this.name = 'BusinessAccessReadError';
    }
}

type AdminLike = { from(table: string): any };

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
