import { logWarn } from '../../lib/log';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export type PublicCategories = {
    /** Active category slugs, the filter identities. */
    slugs: string[];
    /** slug -> display name (categories.name_ru, the only name the table has; the web shows it too). */
    labels: Record<string, string>;
};

/**
 * Every active category with its name, from GET /api/mobile/categories (the same rows the web home page
 * labels with). Through the web API, like the business list: on networks that block *.supabase.co a
 * direct read failed and the chips showed raw slugs. Missing names must not break the catalog: on an
 * error the chips fall back to the slugs seen in the results.
 */
export async function fetchPublicCategories(): Promise<PublicCategories> {
    try {
        const payload = await apiRequest<{ slug: string | null; name_ru: string | null }[] | { data?: { slug: string | null; name_ru: string | null }[] }>('/mobile/categories');
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
        const slugs: string[] = [];
        const labels: Record<string, string> = {};
        for (const row of rows) {
            if (!row.slug) continue;
            slugs.push(row.slug);
            if (row.name_ru?.trim()) labels[row.slug] = row.name_ru.trim();
        }
        return { slugs, labels };
    } catch (error) {
        logWarn('HomeScreen', 'Category labels are unavailable', error);
        return { slugs: [], labels: {} };
    }
}

/** The category's name, or its slug when the table has none. */
export function categoryLabel(labels: Record<string, string>, slug: string): string {
    return Object.prototype.hasOwnProperty.call(labels, slug) ? labels[slug] : slug;
}

/** The union of the lists, first occurrence order, without empty values. */
export function mergeCategorySlugs(...lists: readonly string[][]): string[] {
    const seen = new Set<string>();
    for (const list of lists) {
        for (const slug of list) {
            if (slug) seen.add(slug);
        }
    }
    return Array.from(seen);
}

/**
 * Active promotions per business, counted over the business's active branches like the web home
 * page (apps/web/src/app/page.tsx: promotions_count). RLS returns only promotions inside their
 * dates. A failure only hides the badges.
 */
export async function fetchBusinessPromotionCounts(businessIds: string[]): Promise<Record<string, number>> {
    if (businessIds.length === 0) return {};
    try {
        const branchesResult = await supabase.from('branches').select('id,biz_id').in('biz_id', businessIds).eq('is_active', true);
        if (branchesResult.error) throw branchesResult.error;

        const branches = (branchesResult.data ?? []) as { id: string; biz_id: string }[];
        if (branches.length === 0) return {};

        const branchToBusiness = new Map(branches.map((branch) => [branch.id, branch.biz_id]));
        const promotionsResult = await supabase
            .from('branch_promotions')
            .select('branch_id')
            .eq('is_active', true)
            .in('branch_id', branches.map((branch) => branch.id));
        if (promotionsResult.error) throw promotionsResult.error;

        const counts: Record<string, number> = {};
        for (const promotion of (promotionsResult.data ?? []) as { branch_id: string }[]) {
            const bizId = branchToBusiness.get(promotion.branch_id);
            if (bizId) counts[bizId] = (counts[bizId] ?? 0) + 1;
        }
        return counts;
    } catch (error) {
        logWarn('HomeScreen', 'Promotion counts are unavailable', error);
        return {};
    }
}
