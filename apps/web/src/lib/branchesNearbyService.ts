import { buildApprovedBusinessesQuery } from '@/lib/branches/buildApprovedBusinessesQuery';
import { haversineDistanceKm } from '@/lib/geo';
import { logError } from '@/lib/log';
import { validateLatLon } from '@/lib/validation';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_RADIUS_KM = 20;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;

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

export type BranchNearbyItem = {
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
    distanceKm: number;
};

type Failure = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

type SupabaseLike = {
    from: (table: string) => any;
};

function parseNearbyParams(requestUrl: string) {
    const url = new URL(requestUrl);
    const latParam = url.searchParams.get('lat');
    const lonParam = url.searchParams.get('lon');
    const rawCategoryId = (url.searchParams.get('categoryId') ?? '').trim();
    const rawCityId = (url.searchParams.get('cityId') ?? '').trim();
    const limitParam = url.searchParams.get('limit');
    const radiusParam = url.searchParams.get('radiusKm');

    const v = validateLatLon(latParam != null ? Number(latParam) : undefined, lonParam != null ? Number(lonParam) : undefined);
    if (!v.ok) {
        return {
            ok: false as const,
            error: 'validation',
            message:
                'Координаты lat и lon обязательны и должны быть в диапазоне: lat -90..90, lon -180..180',
            status: 400,
        };
    }

    let limit = DEFAULT_LIMIT;
    if (limitParam != null && limitParam !== '') {
        const n = Number(limitParam);
        if (!Number.isFinite(n) || n < 1) {
            return {
                ok: false as const,
                error: 'validation',
                message: 'Параметр limit должен быть положительным числом',
                status: 400,
            };
        }
        limit = Math.min(Math.floor(n), MAX_LIMIT);
    }

    let radiusKm = DEFAULT_RADIUS_KM;
    if (radiusParam != null && radiusParam !== '') {
        const r = Number(radiusParam);
        if (!Number.isFinite(r) || r < MIN_RADIUS_KM || r > MAX_RADIUS_KM) {
            return {
                ok: false as const,
                error: 'validation',
                message: `Параметр radiusKm должен быть числом от ${MIN_RADIUS_KM} до ${MAX_RADIUS_KM}`,
                status: 400,
            };
        }
        radiusKm = r;
    }

    return {
        ok: true as const,
        data: {
            userLat: v.lat,
            userLon: v.lon,
            rawCategoryId,
            rawCityId,
            limit,
            radiusKm,
        },
    };
}

export async function buildNearbyBranches({
    supabase,
    requestUrl,
}: {
    supabase: SupabaseLike;
    requestUrl: string;
}): Promise<{ ok: true; data: BranchNearbyItem[] } | Failure> {
    const parsed = parseNearbyParams(requestUrl);
    if (!parsed.ok) {
        return parsed;
    }

    const { userLat, userLon, rawCategoryId, rawCityId, limit, radiusKm } = parsed.data;

    try {
        const bizQuery = buildApprovedBusinessesQuery(supabase as never, {
            categoryId: rawCategoryId || undefined,
            cityId: rawCityId || undefined,
        });
        const { data: bizData, error: bizError } = await bizQuery.limit(500);

        if (bizError) {
            logError('BranchesNearby', 'Error loading businesses', bizError);
            return {
                ok: false,
                error: 'internal',
                message: 'Не удалось загрузить компании',
                details: bizError.message,
                status: 500,
            };
        }

        const businesses = (bizData ?? []) as BusinessRow[];
        if (!businesses.length) {
            return { ok: true, data: [] };
        }

        const bizIds = businesses.map((business) => business.id);
        const { data: branchData, error: branchError } = await supabase
            .from('branches')
            .select('id,name,address,biz_id,lat,lon')
            .in('biz_id', bizIds)
            .eq('is_active', true)
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .limit(2000);

        if (branchError) {
            logError('BranchesNearby', 'Error loading branches', branchError);
            return {
                ok: false,
                error: 'internal',
                message: 'Не удалось загрузить филиалы',
                details: branchError.message,
                status: 500,
            };
        }

        const branches = (branchData ?? []) as BranchRow[];
        const businessById = new Map<string, BusinessRow>();
        for (const business of businesses) {
            businessById.set(String(business.id), business);
        }

        const withDistance: Array<{ branch: BranchRow; distanceKm: number }> = [];
        for (const branch of branches) {
            const lat = typeof branch.lat === 'number' ? branch.lat : Number(branch.lat ?? 0);
            const lon = typeof branch.lon === 'number' ? branch.lon : Number(branch.lon ?? 0);
            const distanceKm = haversineDistanceKm(userLat, userLon, lat, lon);
            if (distanceKm <= radiusKm) {
                withDistance.push({ branch, distanceKm });
            }
        }

        withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
        const items = withDistance.slice(0, limit).map(({ branch, distanceKm }) => {
            const business = businessById.get(String(branch.biz_id)) ?? null;
            const categories = business?.categories ?? null;
            const categoryId = rawCategoryId || (Array.isArray(categories) && categories.length > 0 ? String(categories[0] ?? '') : '');

            return {
                id: String(branch.id),
                businessId: String(branch.biz_id),
                businessName: String(business?.name ?? ''),
                businessSlug: business?.slug ? String(business.slug) : null,
                branchName: String(branch.name ?? ''),
                address: branch.address ?? null,
                lat: typeof branch.lat === 'number' ? branch.lat : Number(branch.lat ?? 0),
                lon: typeof branch.lon === 'number' ? branch.lon : Number(branch.lon ?? 0),
                categoryId: categoryId.length ? categoryId : null,
                categoryName: null,
                distanceKm: Math.round(distanceKm * 100) / 100,
            };
        });

        return { ok: true, data: items };
    } catch (error) {
        logError('BranchesNearby', 'Unhandled error in nearby endpoint', error);
        return {
            ok: false,
            error: 'internal',
            message: 'Внутренняя ошибка при поиске ближайших филиалов',
            details: error instanceof Error ? error.message : String(error),
            status: 500,
        };
    }
}
