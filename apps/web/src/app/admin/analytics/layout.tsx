import { Suspense } from 'react';

import { getT } from '@/app/_components/i18n/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

const tabs = [
    { href: '/admin/analytics/overview', key: 'overview', labelFallback: 'Обзор' },
    { href: '/admin/analytics/funnel', key: 'funnel', labelFallback: 'Воронка' },
    { href: '/admin/analytics/load', key: 'load', labelFallback: 'Загрузка' },
    { href: '/admin/analytics/promotions', key: 'promotions', labelFallback: 'Промо' },
] as const;

export const dynamic = 'force-dynamic';

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const t = getT('ru');

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
                        items={tabs.map((tab) => ({
                            key: tab.key,
                            href: tab.href,
                            label: t(`admin.analytics.tabs.${tab.key}` as Parameters<typeof t>[0], tab.labelFallback),
                        }))}
                        className="w-full max-w-3xl"
                        stretch
                    />
                </Suspense>

                <section>{children}</section>
            </div>
        </main>
    );
}

