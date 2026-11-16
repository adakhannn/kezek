/**
 * Public branch discovery (map and nearby). Branches are read together with
 * their approved business in one query, so business filters, coordinates and
 * the optional bounding box all apply in SQL before any row limit. The old
 * two-step read (500 businesses, then a capped branch list in arbitrary order)
 * silently dropped matching branches once the catalogue grew.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logWarn } from '@/lib/log';
import type { PublicCategoryClient } from '@/lib/publicCategoryLabels';
import type { Database } from '@/types/supabase';

// `businesses` alone is ambiguous from branches (business_hourly_load is a
// second path), so the owning foreign key is named explicitly.
const SELECT = 'id,name,address,biz_id,lat,lon,businesses!branches_biz_id_fkey!inner(id,name,slug,categories)';

/** Requested page size. The server may cap it lower (max_rows), so paging stops only on an empty page. */
const PAGE_SIZE = 1000;
export const MAX_BRANCH_ROWS = 10_000;

export type ApprovedBusiness = {
    id: string | number;
    name: string | null;
    slug: string | null;
    categories: string[] | null;
};

export type ApprovedBranchRow = {
    id: string | number;
    name: string | null;
    address: string | null;
    biz_id: string | number;
    lat: number | string | null;
    lon: number | string | null;
    businesses: ApprovedBusiness | ApprovedBusiness[] | null;
};

export type GeoBounds = { minLat: number; maxLat: number; minLon?: number; maxLon?: number };

export type ApprovedBranchFilters = {
    categoryId?: string;
    cityId?: string;
    bounds?: GeoBounds;
};

type QueryResult = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
type BranchQuery = {
    eq(column: string, value: unknown): BranchQuery;
    not(column: string, operator: string, value: unknown): BranchQuery;
    gte(column: string, value: number): BranchQuery;
    lte(column: string, value: number): BranchQuery;
    contains(column: string, value: string[]): BranchQuery;
    order(column: string): { range(from: number, to: number): QueryResult };
};
export type BranchDiscoveryClient = { from(table: string): { select(columns: string): unknown } };

/**
 * The embedded select string is not representable in the typed query builder,
 * and checking the generated client against the narrow shape structurally hits
 * TS2589, so the conversion happens once, here.
 */
export function asDiscoveryClient(supabase: SupabaseClient<Database>): BranchDiscoveryClient & PublicCategoryClient {
    return supabase as unknown as BranchDiscoveryClient & PublicCategoryClient;
}

export type ApprovedBranchesResult =
    | { ok: true; rows: ApprovedBranchRow[]; truncated: boolean }
    | { ok: false; message: string };

export function businessOf(row: ApprovedBranchRow): ApprovedBusiness | null {
    const value = row.businesses;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function coordinate(value: number | string | null): number {
    return typeof value === 'number' ? value : Number(value ?? 0);
}

const KM_PER_DEGREE = 111.32;

/**
 * Conservative latitude/longitude window around a point. The longitude window
 * uses the latitude farthest from the equator, so it never cuts the circle; it
 * is omitted near the poles or across the antimeridian, where it is not one interval.
 */
export function boundingBox(lat: number, lon: number, radiusKm: number): GeoBounds {
    const dLat = radiusKm / KM_PER_DEGREE;
    const minLat = Math.max(-90, lat - dLat);
    const maxLat = Math.min(90, lat + dLat);
    const extremeLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
    const cos = Math.cos((extremeLat * Math.PI) / 180);
    if (cos < 0.01) return { minLat, maxLat };
    const dLon = radiusKm / (KM_PER_DEGREE * cos);
    if (lon - dLon < -180 || lon + dLon > 180) return { minLat, maxLat };
    return { minLat, maxLat, minLon: lon - dLon, maxLon: lon + dLon };
}

export async function loadApprovedBranches(
    supabase: BranchDiscoveryClient,
    filters: ApprovedBranchFilters,
): Promise<ApprovedBranchesResult> {
    const cityId = filters.cityId?.trim();
    const categoryId = filters.categoryId?.trim();
    const rows: ApprovedBranchRow[] = [];

    while (rows.length < MAX_BRANCH_ROWS) {
        let query = (supabase.from('branches').select(SELECT) as BranchQuery)
            .eq('is_active', true)
            .eq('businesses.is_approved', true)
            .not('lat', 'is', null)
            .not('lon', 'is', null);
        if (cityId) query = query.eq('businesses.city_id', cityId);
        if (categoryId) query = query.contains('businesses.categories', [categoryId]);
        const { bounds } = filters;
        if (bounds) {
            query = query.gte('lat', bounds.minLat).lte('lat', bounds.maxLat);
            if (bounds.minLon !== undefined && bounds.maxLon !== undefined) {
                query = query.gte('lon', bounds.minLon).lte('lon', bounds.maxLon);
            }
        }
        const { data, error } = await query.order('id').range(rows.length, rows.length + PAGE_SIZE - 1);
        if (error) return { ok: false, message: error.message };
        const page = (data ?? []) as ApprovedBranchRow[];
        if (!page.length) return { ok: true, rows, truncated: false };
        rows.push(...page);
    }

    logWarn('BranchDiscovery', 'Branch discovery hit the row cap; results are incomplete', {
        cap: MAX_BRANCH_ROWS, cityId: cityId ?? null, categoryId: categoryId ?? null, bounded: !!filters.bounds,
    });
    return { ok: true, rows: rows.slice(0, MAX_BRANCH_ROWS), truncated: true };
}
