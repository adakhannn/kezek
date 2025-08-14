import {JSX} from "react";

import BizClient from './view';

async function getData(slug: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    // маленький fetch без sdk для server component (можно и через @supabase/ssr server client)
    async function q(path: string, init?: RequestInit) {
        const r = await fetch(`${url}/rest/v1/${path}`, {
            ...init,
            headers: { apikey: anon, Authorization: `Bearer ${anon}`, ...(init?.headers||{}) },
            cache: 'no-store'
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }

    const [biz] = await q(`businesses?select=id,slug,name,address,phones&slug=eq.${slug}&is_approved=eq.true&limit=1`);
    if (!biz) return null;

    const services = await q(`services?select=id,name_ru,duration_min,price_from,price_to,active&biz_id=eq.${biz.id}&active=eq.true&order=name_ru.asc`);
    // для MVP: выбираем одного филиала и список мастеров
    const [branch] = await q(`branches?select=id,name&biz_id=eq.${biz.id}&is_active=eq.true&limit=1`);
    const staff = await q(`staff?select=id,full_name&biz_id=eq.${biz.id}&is_active=eq.true&order=full_name.asc`);

    return { biz, branch, services, staff };
}

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;              // ⬅️ обязательно await
    const data = await getData(slug);
    if (!data) return <main className="p-6">Бизнес не найден</main>;
    return <BizClient data={data} />;
}