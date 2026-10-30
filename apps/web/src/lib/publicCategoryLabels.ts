import { logWarn } from '@/lib/log';

export type PublicCategoryClient = {
    from: (table: string) => {
        select: (columns: string) => {
            in: (column: string, values: string[]) => PromiseLike<{
                data: {slug: string; name_ru: string | null}[] | null;
                error: unknown;
            }>;
        };
    };
};

/** Category slugs are filter identities, not display names. Only public metadata is read. */
export async function loadPublicCategoryLabels(client: PublicCategoryClient, slugs: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(slugs.filter(Boolean))];
    if (!unique.length) return {};
    try {
        const { data, error } = await client.from('categories').select('slug,name_ru').in('slug', unique);
        if (error) throw error;
        return Object.fromEntries((data ?? []).filter(row => row.name_ru?.trim()).map(row => [row.slug, row.name_ru!.trim()]));
    } catch (error) {
        // Missing labels must not make the public business list unavailable.
        logWarn('PublicCategories', 'Category labels are unavailable', error);
        return {};
    }
}

export function publicCategoryLabel(labels: Record<string, string>, slug: string): string {
    return Object.hasOwn(labels, slug) ? labels[slug] : slug;
}
