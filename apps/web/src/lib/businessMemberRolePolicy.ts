import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';

/**
 * Role hierarchy for business membership mutations (grant / revoke / invite / demote).
 *
 * - super_admin (global) may manage every business role, including `owner`.
 * - owner may manage admin, manager, staff and client, but not `owner`.
 * - admin may manage manager, staff and client only.
 *
 * A member who holds `owner` can be changed only by a super admin; a member who
 * holds `admin` can be changed only by an owner or a super admin.
 */
export const BUSINESS_MEMBER_ROLE_KEYS = ['owner', 'admin', 'manager', 'staff', 'client'] as const;

export type BusinessMemberRoleKey = (typeof BUSINESS_MEMBER_ROLE_KEYS)[number];

export type BusinessMemberActorLevel = 'super_admin' | 'owner' | 'admin';

const ASSIGNABLE_BY: Record<BusinessMemberActorLevel, ReadonlySet<BusinessMemberRoleKey>> = {
    super_admin: new Set(BUSINESS_MEMBER_ROLE_KEYS),
    owner: new Set<BusinessMemberRoleKey>(['admin', 'manager', 'staff', 'client']),
    admin: new Set<BusinessMemberRoleKey>(['manager', 'staff', 'client']),
};

export function parseBusinessMemberRoleKey(value: unknown): BusinessMemberRoleKey | null {
    if (typeof value !== 'string') return null;
    return (BUSINESS_MEMBER_ROLE_KEYS as readonly string[]).includes(value)
        ? (value as BusinessMemberRoleKey)
        : null;
}

export function canAssignBusinessRole(
    actor: BusinessMemberActorLevel,
    role: BusinessMemberRoleKey,
): boolean {
    return ASSIGNABLE_BY[actor].has(role);
}

/** Whether `actor` may remove or reduce roles of a member who currently holds `targetRoleKeys`. */
export function canChangeBusinessMember(
    actor: BusinessMemberActorLevel,
    targetRoleKeys: readonly string[],
): boolean {
    if (actor === 'super_admin') return true;
    if (targetRoleKeys.includes('owner')) return false;
    if (targetRoleKeys.includes('admin')) return actor === 'owner';
    return true;
}

/**
 * Resolves the caller's level for the business using the caller's own session
 * (RLS client). Returns null when the caller may not manage members at all.
 */
export async function resolveBusinessMemberActor(
    userClient: SupabaseClient,
    bizId: string,
): Promise<BusinessMemberActorLevel | null> {
    const { data: isSuper } = await userClient.rpc('is_super_admin');
    if (isSuper === true) return 'super_admin';

    const { data: isOwner } = await userClient.rpc('has_role', { p_role_key: 'owner', p_biz_id: bizId });
    if (isOwner === true) return 'owner';

    const { data: isAdmin } = await userClient.rpc('has_role', { p_role_key: 'admin', p_biz_id: bizId });
    if (isAdmin === true) return 'admin';

    return null;
}

/** Loads the role keys a user currently holds in the business (service client). */
export async function loadBusinessMemberRoleKeys(
    serviceClient: SupabaseClient,
    bizId: string,
    userId: string,
): Promise<{ ok: true; keys: string[] } | { ok: false }> {
    const { data: rows, error } = await serviceClient
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('biz_id', bizId);
    if (error) {
        logError('BusinessMemberRolePolicy', 'Failed to load member role ids', { bizId, userId, error });
        return { ok: false };
    }

    const roleIds = Array.from(
        new Set((rows ?? []).map((row: { role_id: unknown }) => String(row.role_id))),
    );
    if (roleIds.length === 0) return { ok: true, keys: [] };

    const { data: roles, error: rolesError } = await serviceClient
        .from('roles')
        .select('id,key')
        .in('id', roleIds);
    if (rolesError) {
        logError('BusinessMemberRolePolicy', 'Failed to load member role keys', { bizId, userId, error: rolesError });
        return { ok: false };
    }

    return { ok: true, keys: (roles ?? []).map((role: { key: unknown }) => String(role.key)) };
}
