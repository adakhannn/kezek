import Link from 'next/link';
import { Suspense } from 'react';

import { getT } from '@/app/_components/i18n/server';

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
              {t('admin.analytics.title', 'Аналитика бизнеса')}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t(
                'admin.analytics.subtitle',
                'Конверсия, загрузка по часам и эффективность промо для управленческих решений.',
              )}
            </p>
          </div>
        </header>

        <Suspense fallback={null}>
          <nav className="border-b border-gray-200 dark:border-gray-800">
            <ul className="-mb-px flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <li key={tab.key}>
                  <Link
                    href={tab.href}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2
                      text-gray-600 dark:text-gray-300 border-transparent
                      hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600
                    `}
                  >
                    {t(`admin.analytics.tabs.${tab.key}` as Parameters<typeof t>[0], tab.labelFallback)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Suspense>

        <section>{children}</section>
      </div>
    </main>
  );
}

