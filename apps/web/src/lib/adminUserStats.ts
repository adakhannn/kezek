export type AdminUserStats = { total: number; active: number; blocked: number; super: number };

export type AdminUserPageItem = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    is_blocked: boolean;
    block_reason: string | null;
};

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** public.admin_user_stats (ARCH-03); a malformed answer is a failure, never zero counts. */
export function parseAdminUserStats(data: unknown): AdminUserStats {
    const value = (data ?? {}) as Record<string, unknown>;
    if (!isCount(value.total) || !isCount(value.active) || !isCount(value.blocked) || !isCount(value.super)) {
        throw new Error('Unexpected admin_user_stats payload');
    }
    return { total: value.total, active: value.active, blocked: value.blocked, super: value.super };
}

/** public.admin_list_users (ARCH-03): the page of the whole directory and the number of matches. */
export function parseAdminUserPage(data: unknown): { total: number; items: AdminUserPageItem[] } {
    const value = (data ?? {}) as { total?: unknown; items?: unknown };
    if (!isCount(value.total) || !Array.isArray(value.items)) throw new Error('Unexpected admin_list_users payload');
    const items = value.items.map((raw) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        if (typeof item.id !== 'string' || typeof item.is_blocked !== 'boolean'
            || ![item.full_name, item.email, item.phone, item.last_sign_in_at, item.block_reason].every((field) => field === undefined || isTextOrNull(field))) {
            throw new Error('Unexpected admin_list_users row');
        }
        return {
            id: item.id,
            full_name: (item.full_name as string | null | undefined) ?? null,
            email: (item.email as string | null | undefined) ?? null,
            phone: (item.phone as string | null | undefined) ?? null,
            last_sign_in_at: (item.last_sign_in_at as string | null | undefined) ?? null,
            is_blocked: item.is_blocked,
            block_reason: (item.block_reason as string | null | undefined) ?? null,
        };
    });
    return { total: value.total, items };
}
