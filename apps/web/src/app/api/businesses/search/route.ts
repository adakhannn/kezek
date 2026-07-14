export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

function normalizeQuery(value: string | null) {
    return (value ?? '').trim().slice(0, 80);
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = normalizeQuery(url.searchParams.get('q'));
    const admin = createSupabaseAdminClient();

    let query = admin
        .from('businesses')
        .select('id,name,slug')
        .eq('is_approved', true)
        .order('name', { ascending: true })
        .limit(25);

    if (q) {
        query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
        return Response.json({ ok: false, message: error.message }, { status: 400 });
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
