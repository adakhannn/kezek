import type { PublicBusinessDto } from '@shared-client/types';

type BusinessRow = {
    id: string | number;
    name: string | null;
    slug: string | null;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

type BusinessesQueryLike = {
    or: (filter: string) => BusinessesQueryLike;
    contains: (column: string, value: string[]) => BusinessesQueryLike;
    order: (
        column: string,
        options: { ascending: boolean },
    ) => {
        range: (
            from: number,
            to: number,
        ) => Promise<{
            data: unknown[] | null;
            error: { message: string } | null;
        }>;
    };
};

type BusinessesAnonLike = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: boolean) => BusinessesQueryLike;
        };
    };
};

export type MobileBusinessesResult =
    | {
          ok: true;
          data: PublicBusinessDto[];
      }
    | {
          ok: false;
          error: 'internal';
          message: string;
          details?: unknown;
          status: number;
      };

export async function listMobileBusinesses({
    supabase,
    search,
    category,
    page = 1,
    limit = 20,
}: {
    supabase: BusinessesAnonLike;
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
}): Promise<MobileBusinessesResult> {
    const rawSearch = (search ?? '').trim();
    const rawCategory = (category ?? '').trim();
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let query = supabase
        .from('businesses')
        .select('id,name,slug,address,phones,categories,rating_score')
        .eq('is_approved', true);

    if (rawSearch) {
        const safeQ = rawSearch.slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`);
        const searchPattern = `%${safeQ}%`;
        query = query.or(`name.ilike.${searchPattern},address.ilike.${searchPattern}`);
    }

    if (rawCategory) {
        query = query.contains('categories', [rawCategory]);
    }

    const { data, error } = await query
        .order('name', { ascending: true })
        .range(from, to);

    if (error) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить список бизнесов',
            details: error.message,
            status: 500,
        };
    }

    const rows = (data ?? []) as BusinessRow[];

    return {
        ok: true,
        data: rows.map((business) => ({
            id: String(business.id),
            name: String(business.name ?? ''),
            slug: String(business.slug ?? ''),
            address: business.address ?? null,
            phones: Array.isArray(business.phones) ? business.phones : business.phones ?? null,
            categories: Array.isArray(business.categories) ? business.categories : business.categories ?? null,
            rating_score:
                typeof business.rating_score === 'number'
                    ? business.rating_score
                    : business.rating_score ?? null,
        })),
    };
}
