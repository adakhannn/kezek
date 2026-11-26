import type { DbTableClient } from '@/lib/supabaseTypes';

export type PublicCategoryDto = { slug: string; name_ru: string | null };

export type MobileCategoriesResult =
    | { ok: true; data: PublicCategoryDto[] }
    | { ok: false; error: 'internal'; message: string; status: number };

/**
 * Active public categories (slug and display name) for the app's home chips. Served by the web API so
 * the app does not depend on reaching Supabase directly for them: on networks that block
 * *.supabase.co the chips fell back to raw slugs while the business list (also via this API) loaded.
 */
export async function listMobileCategories(supabase: DbTableClient): Promise<MobileCategoriesResult> {
    const { data, error } = await supabase
        .from('categories')
        .select('slug,name_ru')
        .eq('is_active', true)
        .order('name_ru', { ascending: true });
    if (error) return { ok: false, error: 'internal', message: 'Categories are unavailable', status: 500 };
    return {
        ok: true,
        data: (data ?? [])
            .flatMap((row) => (typeof row.slug === 'string' && row.slug.length > 0
                ? [{ slug: row.slug, name_ru: row.name_ru?.trim() || null }]
                : [])),
    };
}
