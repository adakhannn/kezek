'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export type VisitPackagePlan = {
    id: string;
    biz_id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
    validity_days: number;
    discount_type: 'percent' | 'fixed_price';
    discount_value: number;
    service_id: string | null;
    branch_ids: string[] | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export default function VisitPackagesListClient() {
    const { t } = useLanguage();
    const [plans, setPlans] = useState<VisitPackagePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/visit-package-plans', { cache: 'no-store' });
            const json = await res.json();
            if (!json?.ok || !Array.isArray(json?.data?.plans)) {
                setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список пакетов'));
                setPlans([]);
                return;
            }
            setPlans(json.data.plans);
        } catch {
            setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список пакетов'));
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const handleDeactivate = async (planId: string) => {
        if (!confirm(t('dashboard.visitPackages.deactivateConfirm', 'Деактивировать этот тип пакета?'))) return;
        try {
            const res = await fetch(`/api/dashboard/visit-package-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false }),
            });
            const json = await res.json();
            if (json?.ok) {
                setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, is_active: false } : p)));
            }
        } catch {
            // ignore
        }
    };

    const formatDiscount = (p: VisitPackagePlan) => {
        if (p.discount_type === 'percent') return `${p.discount_value}%`;
        return `${p.discount_value}`;
    };

    const formatBinding = (p: VisitPackagePlan) => {
        const parts: string[] = [];
        if (p.service_id) parts.push('услуга');
        else parts.push('любая услуга');
        if (p.branch_ids && p.branch_ids.length > 0) parts.push(`${p.branch_ids.length} фил.`);
        else parts.push('все филиалы');
        return parts.join(', ');
    };

    return (
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                            {t('dashboard.visitPackages.title', 'Пакеты визитов')}
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            {t('dashboard.visitPackages.subtitle', 'Типы пакетов для продажи клиентам')}
                        </p>
                    </div>
                    <Link
                        href="/dashboard/visit-packages/new"
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('dashboard.visitPackages.create', 'Создать пакет')}
                    </Link>
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
                {!loading && !error && plans.length === 0 && (
                    <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {t('dashboard.visitPackages.empty', 'Нет типов пакетов. Создайте первый пакет.')}
                    </p>
                )}
                {!loading && !error && plans.length > 0 && (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.name', 'Название')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.visits', 'Визитов')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.validityDays', 'Срок (дней)')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.discount', 'Скидка')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.binding', 'Привязка')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.active', 'Статус')}
                                </th>
                                <th className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300" aria-label="Действия">
                                    {' '}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((plan) => (
                                <tr
                                    key={plan.id}
                                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <td className="py-3 px-2 text-gray-900 dark:text-gray-100 font-medium">
                                        {plan.name_ru}
                                    </td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">{plan.visit_count}</td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                                        {plan.validity_days}
                                    </td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                                        {formatDiscount(plan)}
                                    </td>
                                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400 text-xs">
                                        {formatBinding(plan)}
                                    </td>
                                    <td className="py-3 px-2">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                plan.is_active
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            {plan.is_active
                                                ? t('dashboard.visitPackages.active', 'Активен')
                                                : t('dashboard.visitPackages.inactive', 'Неактивен')}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/dashboard/visit-packages/${plan.id}`}
                                                className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
                                            >
                                                {t('dashboard.visitPackages.edit', 'Изменить')}
                                            </Link>
                                            {plan.is_active && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeactivate(plan.id)}
                                                    className="text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
                                                >
                                                    {t('dashboard.visitPackages.deactivate', 'Деактивировать')}
                                                </button>
                                            )}
                                        </div>
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
