import { Suspense } from 'react';

import { getT } from '@/app/_components/i18n/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

type Translate = Awaited<ReturnType<typeof getT>>;

const tabs = (t: Translate) => [
    { href: '/admin/analytics/overview', key: 'overview', label: t('admin.analytics.tabs.overview', 'Обзор') },
    { href: '/admin/analytics/funnel', key: 'funnel', label: t('admin.analytics.tabs.funnel', 'Воронка') },
    { href: '/admin/analytics/load', key: 'load', label: t('admin.analytics.tabs.load', 'Загрузка') },
    { href: '/admin/analytics/promotions', key: 'promotions', label: t('admin.analytics.tabs.promotions', 'Промо') },
];

export const dynamic = 'force-dynamic';

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const t = await getT();

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <PageHeader
                    title={t('admin.analytics.title', 'Аналитика бизнеса')}
                    description={t(
                        'admin.analytics.subtitle',
                        'Конверсия, загрузка по часам и эффективность промо для управленческих решений.',
                    )}
                />

                <Suspense fallback={null}>
                    <Tabs
                        value=""
                        items={tabs(t)}
                        className="w-full max-w-3xl"
                        stretch
                    />
                </Suspense>

                <section>{children}</section>
            </div>
        </main>
    );
}

