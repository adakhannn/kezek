// apps/web/src/app/[slug]/page.tsx
import { JSX } from 'react';

import BizClient from './view';

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

    // все активные услуги бизнеса (дальше фильтруем по филиалу)
    const services = await q(
        `services?select=id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id&biz_id=eq.${biz.id}&active=eq.true&order=name_ru.asc`
    );

    // активные мастера с их "родным" филиалом и аватаркой
    const staff = await q(
        `staff?select=id,full_name,branch_id,avatar_url,rating_score&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=full_name.asc`
    );

    return { biz, branches, services, staff };
}

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;
    const data = await getData(slug);
    if (!data) return <main className="p-6">Бизнес не найден</main>;
    return <BizClient data={data} />;
}
