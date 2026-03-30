import type { SupabaseClient } from '@supabase/supabase-js';

import { buildApprovedBusinessesQuery } from '@/lib/branches/buildApprovedBusinessesQuery';

type BranchRow = {
    id: string | number;
    name: string | null;
    address: string | null;
    biz_id: string | number;
    lat: number | null;
    lon: number | null;
};

type BusinessRow = {
    id: string | number;
    name: string | null;
    slug: string | null;
    categories: string[] | null;
};

export type BranchMapItem = {
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    branchName: string;
    address: string | null;
    lat: number;
    lon: number;
    categoryId: string | null;
    categoryName: string | null;
};

export type BranchesMapResult =
    | {
          ok: true;
          data: BranchMapItem[];
      }
    | {
          ok: false;
          error: 'internal';
          message: string;
          details?: unknown;
          status: number;
      };

export async function listBranchesMap({
    supabase,
    cityId,
    categoryId,
    onlyActive = true,
}: {
    supabase: SupabaseClient | any;
    cityId?: string;
    categoryId?: string;
    onlyActive?: boolean;
}): Promise<BranchesMapResult> {
    const bizQuery = buildApprovedBusinessesQuery(supabase, {
        categoryId: categoryId || undefined,
        cityId: cityId || undefined,
    });

    const { data: bizData, error: bizError } = await bizQuery.limit(500);
    if (bizError) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить компании для карты филиалов',
            details: bizError.message,
            status: 500,
        };
    }

    const businesses = (bizData ?? []) as BusinessRow[];
    if (!businesses.length) {
        return { ok: true, data: [] };
    }

    const bizIds = businesses.map((business) => business.id);

    let branchesQuery = supabase
        .from('branches')
        .select('id,name,address,biz_id,lat,lon')
        .in('biz_id', bizIds)
        .not('lat', 'is', null)
        .not('lon', 'is', null);

    if (onlyActive) {
        branchesQuery = branchesQuery.eq('is_active', true);
    }

    const { data: branchData, error: branchError } = await branchesQuery.limit(500);
    if (branchError) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить филиалы для карты',
            details: branchError.message,
            status: 500,
        };
    }

    const branches = (branchData ?? []) as BranchRow[];
    if (!branches.length) {
        return { ok: true, data: [] };
    }

    const businessById = new Map<string, BusinessRow>();
    for (const business of businesses) {
        businessById.set(String(business.id), business);
    }

    return {
        ok: true,
        data: branches.map((branch) => {
            const business = businessById.get(String(branch.biz_id)) ?? null;
            const categories = business?.categories ?? null;

            let resolvedCategoryId: string | null = null;
            let categoryName: string | null = null;

            if (categoryId) {
                resolvedCategoryId = categoryId || null;
            } else if (Array.isArray(categories) && categories.length > 0) {
                resolvedCategoryId = String(categories[0] ?? '');
            }

            return {
                id: String(branch.id),
                businessId: String(branch.biz_id),
                businessName: String(business?.name ?? ''),
                businessSlug: business?.slug ? String(business.slug) : null,
                branchName: String(branch.name ?? ''),
                address: branch.address ?? null,
                lat: typeof branch.lat === 'number' ? branch.lat : Number(branch.lat ?? 0),
                lon: typeof branch.lon === 'number' ? branch.lon : Number(branch.lon ?? 0),
                categoryId: resolvedCategoryId && resolvedCategoryId.length ? resolvedCategoryId : null,
                categoryName,
            };
        }),
    };
}
