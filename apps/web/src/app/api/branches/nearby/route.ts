export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { haversineDistanceKm } from '@/lib/geo';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
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

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('BranchesNearby', async () => {
                try {
                    const url = new URL(req.url);
                    const latParam = url.searchParams.get('lat');
                    const lonParam = url.searchParams.get('lon');
                    const rawCategoryId = (url.searchParams.get('categoryId') ?? '').trim();
                    const rawCityId = (url.searchParams.get('cityId') ?? '').trim();
                    const limitParam = url.searchParams.get('limit');
                    const radiusParam = url.searchParams.get('radiusKm');

                    const v = validateLatLon(
                        latParam != null ? Number(latParam) : undefined,
                        lonParam != null ? Number(lonParam) : undefined
                    );
                    if (!v.ok) {
                        return createErrorResponse(
                            'validation',
                            'Координаты lat и lon обязательны и должны быть в диапазоне: lat -90..90, lon -180..180',
                            undefined,
                            400
                        );
                    }
                    const userLat = v.lat;
                    const userLon = v.lon;

                    let limit = DEFAULT_LIMIT;
                    if (limitParam != null && limitParam !== '') {
                        const n = Number(limitParam);
                        if (!Number.isFinite(n) || n < 1) {
                            return createErrorResponse('validation', 'Параметр limit должен быть положительным числом', undefined, 400);
                        }
                        limit = Math.min(Math.floor(n), MAX_LIMIT);
                    }

                    let radiusKm = DEFAULT_RADIUS_KM;
                    if (radiusParam != null && radiusParam !== '') {
                        const r = Number(radiusParam);
                        if (!Number.isFinite(r) || r < MIN_RADIUS_KM || r > MAX_RADIUS_KM) {
                            return createErrorResponse(
                                'validation',
                                `Параметр radiusKm должен быть числом от ${MIN_RADIUS_KM} до ${MAX_RADIUS_KM}`,
                                undefined,
                                400
                            );
                        }
                        radiusKm = r;
                    }

                    const supabaseUrl = getSupabaseUrl();
                    const anonKey = getSupabaseAnonKey();
                    const supabase = createClient(supabaseUrl, anonKey, {
                        auth: { persistSession: false, autoRefreshToken: false },
                    });

                    // 1. Бизнесы (одобренные, опционально по категории)
                    let bizQuery = supabase
                        .from('businesses')
                        .select('id,name,slug,categories')
                        .eq('is_approved', true);
                    if (rawCategoryId) {
                        bizQuery = bizQuery.contains('categories', [rawCategoryId]);
                    }
                    // TODO: cityId когда появится в businesses

                    const { data: bizData, error: bizError } = await bizQuery.limit(500);
                    if (bizError) {
                        logError('BranchesNearby', 'Error loading businesses', bizError);
                        return createErrorResponse('internal', 'Не удалось загрузить компании', bizError.message, 500);
                    }
                    const businesses = (bizData ?? []) as BusinessRow[];
                    if (!businesses.length) {
                        return createSuccessResponse<BranchNearbyItem[]>([]);
                    }

                    const bizIds = businesses.map((b) => b.id);

                    // 2. Филиалы: активные, с координатами
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
                        return createErrorResponse('internal', 'Не удалось загрузить филиалы', branchError.message, 500);
                    }
                    const branches = (branchData ?? []) as BranchRow[];

                    const businessById = new Map<string, BusinessRow>();
                    for (const b of businesses) {
                        businessById.set(String(b.id), b);
                    }

                    // 3. Расстояние, фильтр по радиусу, сортировка, limit
                    const withDistance: { branch: BranchRow; distanceKm: number }[] = [];
                    for (const br of branches) {
                        const lat = typeof br.lat === 'number' ? br.lat : Number(br.lat ?? 0);
                        const lon = typeof br.lon === 'number' ? br.lon : Number(br.lon ?? 0);
                        const distanceKm = haversineDistanceKm(userLat, userLon, lat, lon);
                        if (distanceKm <= radiusKm) {
                            withDistance.push({ branch: br, distanceKm });
                        }
                    }
                    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
                    const slice = withDistance.slice(0, limit);

                    const items: BranchNearbyItem[] = slice.map(({ branch: br, distanceKm }) => {
                        const biz = businessById.get(String(br.biz_id)) ?? null;
                        const categories = biz?.categories ?? null;
                        let categoryId: string | null = null;
                        if (rawCategoryId) {
                            categoryId = rawCategoryId || null;
                        } else if (Array.isArray(categories) && categories.length > 0) {
                            categoryId = String(categories[0] ?? '');
                        }
                        return {
                            id: String(br.id),
                            businessId: String(br.biz_id),
                            businessName: String(biz?.name ?? ''),
                            businessSlug: biz?.slug ? String(biz.slug) : null,
                            branchName: String(br.name ?? ''),
                            address: br.address ?? null,
                            lat: typeof br.lat === 'number' ? br.lat : Number(br.lat ?? 0),
                            lon: typeof br.lon === 'number' ? br.lon : Number(br.lon ?? 0),
                            categoryId: categoryId && categoryId.length ? categoryId : null,
                            categoryName: null,
                            distanceKm: Math.round(distanceKm * 100) / 100,
                        };
                    });

                    return createSuccessResponse(items);
                } catch (e) {
                    logError('BranchesNearby', 'Unhandled error in nearby endpoint', e);
                    const msg = e instanceof Error ? e.message : String(e);
                    return createErrorResponse('internal', 'Внутренняя ошибка при поиске ближайших филиалов', msg, 500);
                }
            }),
    );
}
