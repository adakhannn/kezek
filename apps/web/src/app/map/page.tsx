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
    // Ключ передаём с сервера: на проде env может быть доступен только в runtime, не при билде
    const yandexMapsApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? '';
    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <MapPageClient yandexMapsApiKey={yandexMapsApiKey || undefined} />
        </main>
    );
}
