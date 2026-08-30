import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const entries: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: 'daily', priority: 0.8 }];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return entries;

    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/businesses?select=slug&is_approved=eq.true&slug=not.is.null`,
            { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, next: { revalidate: 3600 } },
        );
        if (!response.ok) return entries;
        const businesses = (await response.json()) as Array<{ slug?: string | null }>;
        return [
            ...entries,
            ...businesses
                .filter((business): business is { slug: string } => Boolean(business.slug))
                .map((business) => ({ url: `${base}/b/${business.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
        ];
    } catch {
        return entries;
    }
}
