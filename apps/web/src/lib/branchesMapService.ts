import { businessOf, coordinate, loadApprovedBranches, type BranchDiscoveryClient } from '@/lib/branches/approvedBranches';
import { logError } from '@/lib/log';
import { loadPublicCategoryLabels, type PublicCategoryClient } from '@/lib/publicCategoryLabels';

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

/** Active branches of approved businesses that have coordinates. */
export async function listBranchesMap({
    supabase,
    cityId,
    categoryId,
}: {
    supabase: BranchDiscoveryClient & PublicCategoryClient;
    cityId?: string;
    categoryId?: string;
}): Promise<BranchesMapResult> {
    const result = await loadApprovedBranches(supabase, { cityId, categoryId });
    if (!result.ok) {
        // Database error text stays in the server log; this endpoint is public.
        logError('BranchesMap', 'Error loading branches', result.message);
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить филиалы для карты',
            status: 500,
        };
    }

    const branches = result.rows;
    if (!branches.length) {
        return { ok: true, data: [] };
    }

    const categoryLabels = await loadPublicCategoryLabels(supabase, categoryId
        ? [categoryId] : branches.flatMap(branch => businessOf(branch)?.categories ?? []));

    return {
        ok: true,
        data: branches.map((branch) => {
            const business = businessOf(branch);
            const categories = business?.categories ?? null;
            const resolvedCategoryId = categoryId
                ? categoryId
                : Array.isArray(categories) && categories.length > 0 ? String(categories[0] ?? '') : null;

            return {
                id: String(branch.id),
                businessId: String(branch.biz_id),
                businessName: String(business?.name ?? ''),
                businessSlug: business?.slug ? String(business.slug) : null,
                branchName: String(branch.name ?? ''),
                address: branch.address ?? null,
                lat: coordinate(branch.lat),
                lon: coordinate(branch.lon),
                categoryId: resolvedCategoryId && resolvedCategoryId.length ? resolvedCategoryId : null,
                categoryName: resolvedCategoryId && Object.hasOwn(categoryLabels, resolvedCategoryId)
                    ? categoryLabels[resolvedCategoryId] : null,
            };
        }),
    };
}
