import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JSX } from 'react';

import BusinessInfo from './BusinessInfo';

import { getT, getServerLocale } from '@/app/_components/i18n/server';
import { BusinessPageViewTracker } from '@/lib/analyticsTrackEvent';
import { sanitizeDirectoryLinks } from '@/lib/directoryLinks';
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
        `businesses?select=id,slug,name,address,phones,contact_phone,contact_whatsapp,contact_email,website_url,rating_score,tz&slug=eq.${encodeURIComponent(slug)}&is_approved=eq.true&limit=1`,
    );

    if (!biz) {
        return null;
    }

    const [rawBranches, services, staff] = await Promise.all([
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

    // Кнопки «2ГИС», «Instagram» и карт показываем, только если ссылка ведёт на домен сервиса.
    const branches = rawBranches.map((branch: Record<string, unknown>) => ({
        ...branch,
        directory_links: sanitizeDirectoryLinks(branch.directory_links),
    }));
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
    const fallbackName = t('booking.seo.businessFallback', 'Бизнес');

    const data = await getData(slug);

    if (!data) {
        const titleTemplate = t('business.seo.title');
        const descTemplate = t('business.seo.description');

        return {
            title: titleTemplate.replace('{businessName}', fallbackName),
            description: descTemplate.replace('{businessName}', fallbackName),
            alternates: generateAlternates(`/b/${slug}`),
        };
    }

    const businessName = data.biz.name || fallbackName;
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
        // A real 404 for search engines and link previews; ./not-found.tsx renders the same state.
        notFound();
    }

    return (
        <>
            <BusinessPageViewTracker bizId={data.biz.id} />
            <BusinessInfo data={data} />
        </>
    );
}
