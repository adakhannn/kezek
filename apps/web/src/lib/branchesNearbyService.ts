import {
    boundingBox,
    businessOf,
    coordinate,
    loadApprovedBranches,
    type ApprovedBranchRow,
    type BranchDiscoveryClient,
} from '@/lib/branches/approvedBranches';
import { haversineDistanceKm } from '@/lib/geo';
import { logError } from '@/lib/log';
import { loadPublicCategoryLabels, type PublicCategoryClient } from '@/lib/publicCategoryLabels';
import { validateLatLon } from '@/lib/validation';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_RADIUS_KM = 20;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;

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
    supabase: BranchDiscoveryClient & PublicCategoryClient;
    requestUrl: string;
}): Promise<{ ok: true; data: BranchNearbyItem[] } | Failure> {
    const parsed = parseNearbyParams(requestUrl);
    if (!parsed.ok) {
        return parsed;
    }

    const { userLat, userLon, rawCategoryId, rawCityId, limit, radiusKm } = parsed.data;

    try {
        // The bounding box is applied in SQL, so the candidate set is every
        // matching branch around the point rather than an arbitrary first page.
        const result = await loadApprovedBranches(supabase, {
            categoryId: rawCategoryId || undefined,
            cityId: rawCityId || undefined,
            bounds: boundingBox(userLat, userLon, radiusKm),
        });
        if (!result.ok) {
            logError('BranchesNearby', 'Error loading branches', result.message);
            return { ok: false, error: 'internal', message: 'Не удалось загрузить филиалы', status: 500 };
        }

        const withDistance: Array<{ branch: ApprovedBranchRow; distanceKm: number }> = [];
        for (const branch of result.rows) {
            const distanceKm = haversineDistanceKm(userLat, userLon, coordinate(branch.lat), coordinate(branch.lon));
            if (distanceKm <= radiusKm) {
                withDistance.push({ branch, distanceKm });
            }
        }

        withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
        const nearest = withDistance.slice(0, limit).map(({ branch, distanceKm }) => {
            const business = businessOf(branch);
            const categories = business?.categories ?? null;
            const categoryId = rawCategoryId || (Array.isArray(categories) && categories.length > 0 ? String(categories[0] ?? '') : '');
            return { branch, business, distanceKm, categoryId: categoryId.length ? categoryId : null };
        });
        const labels = await loadPublicCategoryLabels(supabase, nearest.flatMap(item => item.categoryId ? [item.categoryId] : []));

        return {
            ok: true,
            data: nearest.map(({ branch, business, distanceKm, categoryId }) => ({
                id: String(branch.id),
                businessId: String(branch.biz_id),
                businessName: String(business?.name ?? ''),
                businessSlug: business?.slug ? String(business.slug) : null,
                branchName: String(branch.name ?? ''),
                address: branch.address ?? null,
                lat: coordinate(branch.lat),
                lon: coordinate(branch.lon),
                categoryId,
                categoryName: categoryId && Object.hasOwn(labels, categoryId) ? labels[categoryId] : null,
                distanceKm: Math.round(distanceKm * 100) / 100,
            })),
        };
    } catch (error) {
        logError('BranchesNearby', 'Unhandled error in nearby endpoint', error);
        return {
            ok: false,
            error: 'internal',
            message: 'Внутренняя ошибка при поиске ближайших филиалов',
            status: 500,
        };
    }
}
