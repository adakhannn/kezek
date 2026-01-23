import { JSX } from 'react';

import PromotionsPageClient from './PromotionsPageClient';

async function getData(slug: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    async function q(path: string, init?: RequestInit) {
        const r = await fetch(`${url}/rest/v1/${path}`, {
            ...init,
            headers: { apikey: anon, Authorization: `Bearer ${anon}`, ...(init?.headers || {}) },
            cache: 'no-store',
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }

    const [biz] = await q(
        `businesses?select=id,slug,name,address,phones,rating_score&slug=eq.${slug}&is_approved=eq.true&limit=1`
    );
    if (!biz) return null;

    const branches = await q(
        `branches?select=id,name,address,rating_score&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=name.asc`
    );

    // активные акции для всех филиалов бизнеса с полной информацией
    const branchIds = branches.map((b: { id: string }) => b.id);
    let promotions: Array<{
        id: string;
        branch_id: string;
        promotion_type: string;
        title_ru: string | null;
        title_ky?: string | null;
        title_en?: string | null;
        description_ru?: string | null;
        description_ky?: string | null;
        description_en?: string | null;
        params: Record<string, unknown>;
        valid_from?: string | null;
        valid_to?: string | null;
        branches?: { name: string };
    }> = [];

    if (branchIds.length > 0) {
        const branchIdsStr = branchIds.join(',');
        promotions = await q(
            `branch_promotions?select=id,branch_id,promotion_type,title_ru,title_ky,title_en,description_ru,description_ky,description_en,params,valid_from,valid_to,branches(name)&branch_id=in.(${branchIdsStr})&is_active=eq.true&order=created_at.desc`
        );
    }

    return { biz, branches, promotions };
}

export default async function PromotionsPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;
    const data = await getData(slug);
    if (!data) return <main className="p-6">Бизнес не найден</main>;
    return <PromotionsPageClient data={data} />;
}

