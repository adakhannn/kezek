// apps/web/src/app/api/mobile/businesses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { PublicBusinessDto } from '@shared-client/types';
import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

type BusinessRow = {
    id: string | number;
    name: string | null;
    slug: string | null;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('MobileBusinesses', async () => {
                const url = new URL(req.url);
                const rawSearch = (url.searchParams.get('search') ?? '').trim();
                const rawCategory = (url.searchParams.get('category') ?? '').trim();

                const supabaseUrl = getSupabaseUrl();
                const anonKey = getSupabaseAnonKey();

                const supabase = createClient(supabaseUrl, anonKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                    },
                });

                let query = supabase
                    .from('businesses')
                    .select('id,name,slug,address,phones,categories,rating_score')
                    .eq('is_approved', true);

                if (rawSearch) {
                    // Повторяем серверную версию "безопасного" поиска
                    const safeQ = rawSearch.slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`);
                    const searchPattern = `%${safeQ}%`;
                    query = query.or(`name.ilike.${searchPattern},address.ilike.${searchPattern}`);
                }

                if (rawCategory) {
                    query = query.contains('categories', [rawCategory]);
                }

                const { data, error } = await query.order('name', { ascending: true }).limit(50);

                if (error) {
                    logError('MobileBusinesses', 'Error loading businesses', error);
                    return createErrorResponse('internal', 'Не удалось загрузить список бизнесов', error.message, 500);
                }

                const rows = (data ?? []) as BusinessRow[];

                const items: PublicBusinessDto[] = rows.map((b) => ({
                    id: String(b.id),
                    name: String(b.name ?? ''),
                    slug: String(b.slug ?? ''),
                    address: b.address ?? null,
                    phones: Array.isArray(b.phones) ? b.phones : b.phones ?? null,
                    categories: Array.isArray(b.categories) ? b.categories : b.categories ?? null,
                    rating_score: typeof b.rating_score === 'number' ? b.rating_score : b.rating_score ?? null,
                }));

                return createSuccessResponse(items);
            }),
    );
}

