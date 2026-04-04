import { Suspense } from 'react';

import { getT } from '@/app/_components/i18n/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

const tabs = [
    { href: '/admin/analytics/overview', key: 'overview', labelFallback: 'РћР±Р·РѕСЂ' },
    { href: '/admin/analytics/funnel', key: 'funnel', labelFallback: 'Р’РѕСЂРѕРЅРєР°' },
    { href: '/admin/analytics/load', key: 'load', labelFallback: 'Р—Р°РіСЂСѓР·РєР°' },
    { href: '/admin/analytics/promotions', key: 'promotions', labelFallback: 'РџСЂРѕРјРѕ' },
] as const;

export const dynamic = 'force-dynamic';

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const t = getT('ru');

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <PageHeader
                    title={t('admin.analytics.title', 'РђРЅР°Р»РёС‚РёРєР° Р±РёР·РЅРµСЃР°')}
                    description={t(
                        'admin.analytics.subtitle',
                        'РљРѕРЅРІРµСЂСЃРёСЏ, Р·Р°РіСЂСѓР·РєР° РїРѕ С‡Р°СЃР°Рј Рё СЌС„С„РµРєС‚РёРІРЅРѕСЃС‚СЊ РїСЂРѕРјРѕ РґР»СЏ СѓРїСЂР°РІР»РµРЅС‡РµСЃРєРёС… СЂРµС€РµРЅРёР№.',
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
