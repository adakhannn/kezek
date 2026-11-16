export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { businessSearchFilter, normalizeBusinessSearchQuery } from '@/lib/businessSearch';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function GET(request: Request) {
    // Typeahead with a 250 ms debounce: the `normal` budget, not the strict public one.
    return withRateLimit(request, RateLimitConfigs.normal, () => search(request), '/api/businesses/search');
}

async function search(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const q = normalizeBusinessSearchQuery(url.searchParams.get('q'));
    // Approved businesses are public: the anon client and RLS are enough.
    const supabase = createSupabaseAnonClient();

    let query = supabase
        .from('businesses')
        .select('id,name,slug')
        .eq('is_approved', true)
        .order('name', { ascending: true })
        .limit(25);

    if (q) {
        query = query.or(businessSearchFilter(q));
    }

    const { data, error } = await query;
    if (error) {
        logError('BusinessSearch', 'Search query failed', error);
        return Response.json({ ok: false, message: 'Не удалось загрузить бизнесы' }, { status: 500 });
    }

    return Response.json({
        ok: true,
        items: (data ?? []).map((business) => ({
            id: business.id,
            name: business.name,
            slug: business.slug ?? null,
        })),
    });
}
