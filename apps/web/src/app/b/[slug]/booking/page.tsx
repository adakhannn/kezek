import type { Metadata } from 'next';
import { JSX } from 'react';

import { BookingFormClient } from './BookingFormClient';
import { getT, getServerLocale } from '@/app/_components/i18n/LanguageProvider';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { generateAlternates } from '@/lib/seo';

async function getData(slug: string) {
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    async function q(path: string, init?: RequestInit) {
        const r = await fetch(`${url}/rest/v1/${path}`, {
            ...init,
            headers: { apikey: anon, Authorization: `Bearer ${anon}`, ...(init?.headers || {}) },
            cache: 'no-store',
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }

    // Оптимизация: сначала получаем бизнес, затем параллельно загружаем все остальные данные
    const [biz] = await q(
        `businesses?select=id,slug,name,address,phones,rating_score&slug=eq.${slug}&is_approved=eq.true&limit=1`
    );
    if (!biz) return null;

    // Параллельная загрузка всех данных для улучшения производительности
    const [branches, services, staff] = await Promise.all([
        q(
            `branches?select=id,name,address,rating_score&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=name.asc`
        ),
        q(
            `services?select=id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id&biz_id=eq.${biz.id}&active=eq.true&order=name_ru.asc`
        ),
        q(
            `staff?select=id,full_name,branch_id,avatar_url,rating_score&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=full_name.asc`
        ),
    ]);

    // Активные акции для всех филиалов бизнеса (загружаем после получения branches)
    const branchIds = branches.map((b: { id: string }) => b.id);
    let promotions: Array<{
        id: string;
        branch_id: string;
        promotion_type: string;
        title_ru: string | null;
        params: Record<string, unknown>;
        branches?: { name: string };
    }> = [];

    if (branchIds.length > 0) {
        const branchIdsStr = branchIds.join(',');
        promotions = await q(
            `branch_promotions?select=id,branch_id,promotion_type,title_ru,params,branches(name)&branch_id=in.(${branchIdsStr})&is_active=eq.true&order=created_at.desc`
        );
    }

    return { biz, branches, services, staff, promotions };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const locale = await getServerLocale();
    const t = getT(locale);
    
    // Получаем данные о бизнесе для метаданных
    const data = await getData(slug);
    if (!data) {
        const titleTemplate = t('booking.seo.title');
        const descTemplate = t('booking.seo.description');
        return {
            title: titleTemplate.replace('{businessName}', 'Бизнес'),
            description: descTemplate.replace('{businessName}', 'Бизнес'),
            alternates: generateAlternates(`/b/${slug}/booking`),
        };
    }
    
    const businessName = data.biz.name || 'Бизнес';
    const titleTemplate = t('booking.seo.title');
    const descTemplate = t('booking.seo.description');
    
    return {
        title: titleTemplate.replace('{businessName}', businessName),
        description: descTemplate.replace('{businessName}', businessName),
        alternates: generateAlternates(`/b/${slug}/booking`),
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;
    const data = await getData(slug);
    if (!data) return <main className="p-6">Бизнес не найден</main>;
    return <BookingFormClient data={data} />;
}


