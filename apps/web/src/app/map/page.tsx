import type { Metadata } from 'next';

import MapPageClient from './MapPageClient';

import { getT, getServerLocale } from '@/app/_components/i18n/server';
import { generateAlternates } from '@/lib/seo';


export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const t = getT(locale);
    return {
        title: t('common.map.title', 'Карта филиалов'),
        alternates: generateAlternates('/map'),
    };
}

export default function MapPage() {
    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <MapPageClient />
        </main>
    );
}
