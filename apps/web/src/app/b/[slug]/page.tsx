import type { Metadata } from 'next';
import { JSX } from 'react';

import BusinessInfo from './BusinessInfo';
import BusinessPageState from './BusinessPageState';

import { getT, getServerLocale } from '@/app/_components/i18n/server';
import { BusinessPageViewTracker } from '@/lib/analyticsTrackEvent';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { generateAlternates } from '@/lib/seo';

async function getData(slug: string) {
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    async function q(path: string, init?: RequestInit) {
        const response = await fetch(`${url}/rest/v1/${path}`, {
            ...init,
            headers: { apikey: anon, Authorization: `Bearer ${anon}`, ...(init?.headers || {}) },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json();
    }

    const [biz] = await q(
        `businesses?select=id,slug,name,address,phones,contact_phone,contact_whatsapp,contact_email,website_url,rating_score,tz&slug=eq.${slug}&is_approved=eq.true&limit=1`,
    );

    if (!biz) {
        return null;
    }

    const [branches, services, staff] = await Promise.all([
        q(
            `branches?select=id,name,address,rating_score,directory_links,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=name.asc`,
        ),
        q(
            `services?select=id,name_ru,name_ky,name_en,duration_min,price_from,price_to,branch_id&biz_id=eq.${biz.id}&active=eq.true&order=name_ru.asc`,
        ),
        q(
            `staff?select=id,full_name,branch_id,avatar_url,rating_score&biz_id=eq.${biz.id}&is_active=eq.true&order=rating_score.desc.nullslast&order=full_name.asc`,
        ),
    ]);

    const branchIds = branches.map((branch: { id: string }) => branch.id);
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
            `branch_promotions?select=id,branch_id,promotion_type,title_ru,params,branches(name)&branch_id=in.(${branchIdsStr})&is_active=eq.true&order=created_at.desc&limit=50`,
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

    const data = await getData(slug);

    if (!data) {
        const titleTemplate = t('business.seo.title');
        const descTemplate = t('business.seo.description');

        return {
            title: titleTemplate.replace('{businessName}', 'Бизнес'),
            description: descTemplate.replace('{businessName}', 'Бизнес'),
            alternates: generateAlternates(`/b/${slug}`),
        };
    }

    const businessName = data.biz.name || 'Бизнес';
    const titleTemplate = t('business.seo.title');
    const descTemplate = t('business.seo.description');

    return {
        title: titleTemplate.replace('{businessName}', businessName),
        description: descTemplate.replace('{businessName}', businessName),
        alternates: generateAlternates(`/b/${slug}`),
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;
    const data = await getData(slug);

    if (!data) {
        return <BusinessPageState kind="not-found" />;
    }

    return (
        <>
            <BusinessPageViewTracker bizId={data.biz.id} />
            <BusinessInfo data={data} />
        </>
    );
}
