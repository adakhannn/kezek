export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

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

type BranchMapItem = {
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

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('BranchesMap', async () => {
                try {
                    const url = new URL(req.url);
                    const rawCityId = (url.searchParams.get('cityId') ?? '').trim();
                    const rawCategoryId = (url.searchParams.get('categoryId') ?? '').trim();
                    const onlyActiveParam = url.searchParams.get('onlyActive');

                    const onlyActive = onlyActiveParam == null ? true : onlyActiveParam !== 'false';

                    const supabaseUrl = getSupabaseUrl();
                    const anonKey = getSupabaseAnonKey();

                    const supabase = createClient(supabaseUrl, anonKey, {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                        },
                    });

                    // 1. Загружаем бизнесы (одиночным запросом, с фильтрацией по категории/городу)
                    let bizQuery = supabase
                        .from('businesses')
                        .select('id,name,slug,categories')
                        .eq('is_approved', true);

                    if (rawCategoryId) {
                        bizQuery = bizQuery.contains('categories', [rawCategoryId]);
                    }

                    // TODO: когда появится city_id у businesses — добавить фильтр по городу:
                    // if (rawCityId) { bizQuery = bizQuery.eq('city_id', rawCityId); }

                    const { data: bizData, error: bizError } = await bizQuery.limit(500);
                    if (bizError) {
                        logError('BranchesMap', 'Error loading businesses for branches map', bizError);
                        return createErrorResponse('internal', 'Не удалось загрузить компании для карты филиалов', bizError.message, 500);
                    }

                    const businesses = (bizData ?? []) as BusinessRow[];
                    if (!businesses.length) {
                        return createSuccessResponse<BranchMapItem[]>([]);
                    }

                    const bizIds = businesses.map((b) => b.id);

                    // 2. Загружаем филиалы по этим бизнесам
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
                        logError('BranchesMap', 'Error loading branches for map', branchError);
                        return createErrorResponse('internal', 'Не удалось загрузить филиалы для карты', branchError.message, 500);
                    }

                    const branches = (branchData ?? []) as BranchRow[];
                    if (!branches.length) {
                        return createSuccessResponse<BranchMapItem[]>([]);
                    }

                    // 3. Собираем удобный DTO для фронта
                    const businessById = new Map<string, BusinessRow>();
                    for (const b of businesses) {
                        businessById.set(String(b.id), b);
                    }

                    const items: BranchMapItem[] = branches.map((br) => {
                        const biz = businessById.get(String(br.biz_id)) ?? null;

                        const categories = biz?.categories ?? null;
                        let categoryId: string | null = null;
                        let categoryName: string | null = null;

                        if (rawCategoryId) {
                            categoryId = rawCategoryId || null;
                            // Название категории можно подтягивать отдельно при необходимости;
                            // сейчас оставляем null, чтобы не плодить лишние JOIN-ы.
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
                            categoryName,
                        };
                    });

                    return createSuccessResponse(items);
                } catch (e) {
                    logError('BranchesMap', 'Unhandled error in branches map endpoint', e);
                    const msg = e instanceof Error ? e.message : String(e);
                    return createErrorResponse('internal', 'Внутренняя ошибка при загрузке карты филиалов', msg, 500);
                }
            }),
    );
}

