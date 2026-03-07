'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type PackageItem = {
  id: string;
  plan_id: string;
  plan_name_ru: string | null;
  plan_name_ky: string | null;
  plan_name_en: string | null;
  remaining_visits: number;
  plan_visit_count: number | null;
  valid_until: string;
  purchased_at: string;
  created_at: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

function isActive(p: PackageItem): boolean {
  return p.valid_until >= TODAY && p.remaining_visits > 0;
}

export default function MyVisitPackagesBlock() {
  const { t, locale } = useLanguage();
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredOpen, setExpiredOpen] = useState(false);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/me/visit-packages?status=all', { cache: 'no-store' });
      const json = await res.json();
      if (json?.ok && Array.isArray(json?.data?.packages)) {
        setPackages(json.data.packages);
      } else {
        setPackages([]);
      }
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const planName = (p: PackageItem) =>
    p.plan_name_ru || p.plan_name_ky || p.plan_name_en || '—';

  const activeList = packages.filter(isActive);
  const expiredList = packages.filter((p) => !isActive(p));

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('cabinet.packages.loading', 'Загрузка пакетов...')}
        </p>
      </div>
    );
  }

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {t('cabinet.packages.title', 'Мои пакеты')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('cabinet.packages.subtitle', 'Активные пакеты визитов')}
        </p>

        {activeList.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeList.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {planName(pkg)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('cabinet.packages.remaining', 'Осталось')}: {pkg.remaining_visits}
                  {pkg.plan_visit_count != null && ` ${t('cabinet.packages.of', 'из')} ${pkg.plan_visit_count}`}{' '}
                  {t('cabinet.packages.visits', 'визитов')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {t('cabinet.packages.validUntil', 'Действует до')}: {formatDate(pkg.valid_until)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('cabinet.packages.noActive', 'Нет активных пакетов')}
          </p>
        )}

        {expiredList.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setExpiredOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expiredOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t('cabinet.packages.expiredToggle', 'Истёкшие')} ({expiredList.length})
            </button>
            {expiredOpen && (
              <div className="mt-3 space-y-2 pl-6">
                {expiredList.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="text-sm text-gray-500 dark:text-gray-500 border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-400">
                      {planName(pkg)}
                    </span>
                    {' — '}
                    {pkg.remaining_visits} {t('cabinet.packages.visits', 'визитов')},{' '}
                    {t('cabinet.packages.until', 'до')} {formatDate(pkg.valid_until)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
