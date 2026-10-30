export type AdminUserStats = { total: number; active: number; blocked: number; super: number };
type StatUser = { id: string; is_blocked: boolean; is_super: boolean };

/** The list transport caps pages at 200; never fabricate zero counts on a failed page. */
export async function collectAdminUserStats(loadPage: (page: number, perPage: number) => Promise<{ items: StatUser[] }>): Promise<AdminUserStats> {
    const size = 200;
    const seen = new Set<string>();
    const stats = { total: 0, active: 0, blocked: 0, super: 0 };
    for (let page = 1; page <= 1000; page++) {
        const { items } = await loadPage(page, size);
        for (const user of items) {
            if (seen.has(user.id)) continue;
            seen.add(user.id);
            stats.total++;
            if (user.is_blocked) stats.blocked++; else stats.active++;
            if (user.is_super) stats.super++;
        }
        if (items.length < size) return stats;
    }
    throw new Error('User statistics exceed the supported pagination limit');
}
