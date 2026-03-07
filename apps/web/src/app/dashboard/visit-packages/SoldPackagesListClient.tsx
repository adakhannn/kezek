'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export type SoldPackage = {
    id: string;
    client_id: string;
    client_name: string | null;
    plan_id: string;
    remaining_visits: number;
    valid_until: string;
    purchased_at: string;
    created_at: string;
    plan_name_ru: string | null;
    plan_name_ky: string | null;
    plan_name_en: string | null;
    plan_visit_count: number | null;
};

type BranchOption = { id: string; name: string };

type StatusFilter = 'all' | 'active' | 'expired';

export default function SoldPackagesListClient() {
    const { t, locale } = useLanguage();
    const [packages, setPackages] = useState<SoldPackage[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
    const [branchId, setBranchId] = useState<string>('');

    const fetchBranches = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/branches/list', { cache: 'no-store' });
            const json = await res.json();
            if (json?.ok && Array.isArray(json.data)) {
                setBranches(json.data);
            }
        } catch {
            setBranches([]);
        }
    }, []);

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (branchId) params.set('branchId', branchId);
            const res = await fetch(`/api/dashboard/visit-packages?${params.toString()}`, {
                cache: 'no-store',
            });
            const json = await res.json();
            if (!json?.ok || !Array.isArray(json?.data?.packages)) {
                setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список'));
                setPackages([]);
                return;
            }
            setPackages(json.data.packages);
        } catch {
            setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список'));
            setPackages([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, branchId, t]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    useEffect(() => {
        fetchPackages();
    }, [fetchPackages]);

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t('dashboard.visitPackages.sold.title', 'Проданные пакеты')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('dashboard.visitPackages.sold.subtitle', 'Список проданных пакетов по бизнесу с остатком визитов и датой окончания')}
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('dashboard.visitPackages.sold.filterStatus', 'Статус')}:
                    </span>
                    {(['active', 'expired', 'all'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                statusFilter === s
                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {s === 'active'
                                ? t('dashboard.visitPackages.sold.statusActive', 'Активные')
                                : s === 'expired'
                                  ? t('dashboard.visitPackages.sold.statusExpired', 'Истёкшие')
                                  : t('dashboard.visitPackages.sold.statusAll', 'Все')}
                        </button>
                    ))}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">
                        {t('dashboard.visitPackages.sold.filterBranch', 'Филиал')}:
                    </span>
                    <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-1.5"
                    >
                        <option value="">{t('dashboard.visitPackages.sold.branchAll', 'Все')}</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg border border-gray-200 dark:border-gray-800 overflow-x-auto">
                {loading && (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {t('dashboard.integrations.loading', 'Загрузка...')}
                    </div>
                )}
                {error && (
                    <div className="py-6 text-center text-red-600 dark:text-red-400" role="alert">
                        {error}
                    </div>
                )}
                {!loading && !error && packages.length === 0 && (
                    <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {t('dashboard.visitPackages.sold.empty', 'Нет проданных пакетов по выбранным фильтрам')}
                    </p>
                )}
                {!loading && !error && packages.length > 0 && (
                    <table data-testid="sold-packages-table" className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.sold.colClient', 'Клиент')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.sold.colPlan', 'Пакет')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.sold.colRemaining', 'Осталось визитов')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.sold.colValidUntil', 'Действует до')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.sold.colPurchased', 'Куплен')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map((pkg) => (
                                <tr
                                    key={pkg.id}
                                    data-testid="sold-package-row"
                                    data-plan-name={pkg.plan_name_ru ?? ''}
                                    data-remaining={String(pkg.remaining_visits)}
                                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <td className="py-3 px-2 text-gray-900 dark:text-gray-100 font-medium">
                                        {pkg.client_name ?? pkg.client_id.slice(0, 8) + '…'}
                                    </td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                                        {pkg.plan_name_ru ?? '—'}
                                    </td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                                        {pkg.remaining_visits}
                                        {pkg.plan_visit_count != null && ` / ${pkg.plan_visit_count}`}
                                    </td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                                        {formatDate(pkg.valid_until)}
                                    </td>
                                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                                        {formatDate(pkg.purchased_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
