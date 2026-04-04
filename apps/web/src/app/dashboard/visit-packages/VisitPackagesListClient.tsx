'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

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
    const toast = useToast();
    const [plans, setPlans] = useState<VisitPackagePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmPlanId, setConfirmPlanId] = useState<string | null>(null);

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/visit-package-plans', {
                cache: 'no-store',
            });
            const json = await res.json();
            if (!json?.ok || !Array.isArray(json?.data?.plans)) {
                setError(
                    t(
                        'dashboard.visitPackages.loadError',
                        'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РїР°РєРµС‚РѕРІ',
                    ),
                );
                setPlans([]);
                return;
            }
            setPlans(json.data.plans);
        } catch {
            setError(
                t(
                    'dashboard.visitPackages.loadError',
                    'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РїР°РєРµС‚РѕРІ',
                ),
            );
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const handleDeactivate = async (planId: string) => {
        try {
            const res = await fetch(`/api/dashboard/visit-package-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false }),
            });
            const json = await res.json();
            if (json?.ok) {
                setPlans((prev) =>
                    prev.map((p) => (p.id === planId ? { ...p, is_active: false } : p)),
                );
                setConfirmPlanId(null);
                toast.showSuccess(
                    t(
                        'dashboard.visitPackages.deactivateSuccess',
                        'РџР°РєРµС‚ РґРµР°РєС‚РёРІРёСЂРѕРІР°РЅ',
                    ),
                );
            } else {
                toast.showError(
                    t(
                        'dashboard.visitPackages.deactivateError',
                        'РќРµ СѓРґР°Р»РѕСЃСЊ РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ РїР°РєРµС‚',
                    ),
                );
            }
        } catch {
            toast.showError(
                t(
                    'dashboard.visitPackages.deactivateError',
                    'РќРµ СѓРґР°Р»РѕСЃСЊ РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ РїР°РєРµС‚',
                ),
            );
        }
    };

    const formatDiscount = (p: VisitPackagePlan) => {
        if (p.discount_type === 'percent') return `${p.discount_value}%`;
        return `${p.discount_value}`;
    };

    const formatBinding = (p: VisitPackagePlan) => {
        const parts: string[] = [];
        if (p.service_id) parts.push('СѓСЃР»СѓРіР°');
        else parts.push('Р»СЋР±Р°СЏ СѓСЃР»СѓРіР°');
        if (p.branch_ids && p.branch_ids.length > 0) parts.push(`${p.branch_ids.length} С„РёР».`);
        else parts.push('РІСЃРµ С„РёР»РёР°Р»С‹');
        return parts.join(', ');
    };

    return (
        <div className="space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100 sm:mb-2 sm:text-3xl">
                            {t('dashboard.visitPackages.title', 'РџР°РєРµС‚С‹ РІРёР·РёС‚РѕРІ')}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                            {t(
                                'dashboard.visitPackages.subtitle',
                                'РўРёРїС‹ РїР°РєРµС‚РѕРІ РґР»СЏ РїСЂРѕРґР°Р¶Рё РєР»РёРµРЅС‚Р°Рј',
                            )}
                        </p>
                    </div>
                    <Link
                        href="/dashboard/visit-packages/new"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-pink-600 px-3 py-2 text-xs font-medium text-white shadow-md transition-all duration-200 hover:from-indigo-700 hover:to-pink-700 hover:shadow-lg sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        {t('dashboard.visitPackages.create', 'РЎРѕР·РґР°С‚СЊ РїР°РєРµС‚')}
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl sm:p-4">
                {loading && (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {t('dashboard.integrations.loading', 'Р—Р°РіСЂСѓР·РєР°...')}
                    </div>
                )}
                {error && (
                    <div className="py-6 text-center text-red-600 dark:text-red-400" role="alert">
                        {error}
                    </div>
                )}
                {!loading && !error && plans.length === 0 && (
                    <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {t(
                            'dashboard.visitPackages.empty',
                            'РќРµС‚ С‚РёРїРѕРІ РїР°РєРµС‚РѕРІ. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІС‹Р№ РїР°РєРµС‚.',
                        )}
                    </p>
                )}
                {!loading && !error && plans.length > 0 && (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.name', 'РќР°Р·РІР°РЅРёРµ')}
                                </th>
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.visits', 'Р’РёР·РёС‚РѕРІ')}
                                </th>
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.validityDays', 'РЎСЂРѕРє (РґРЅРµР№)')}
                                </th>
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.discount', 'РЎРєРёРґРєР°')}
                                </th>
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.binding', 'РџСЂРёРІСЏР·РєР°')}
                                </th>
                                <th className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300">
                                    {t('dashboard.visitPackages.active', 'РЎС‚Р°С‚СѓСЃ')}
                                </th>
                                <th
                                    className="px-2 py-3 font-medium text-gray-700 dark:text-gray-300"
                                    aria-label="Р”РµР№СЃС‚РІРёСЏ"
                                >
                                    {' '}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((plan) => (
                                <tr
                                    key={plan.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                                >
                                    <td className="px-2 py-3 font-medium text-gray-900 dark:text-gray-100">
                                        {plan.name_ru}
                                    </td>
                                    <td className="px-2 py-3 text-gray-700 dark:text-gray-300">
                                        {plan.visit_count}
                                    </td>
                                    <td className="px-2 py-3 text-gray-700 dark:text-gray-300">
                                        {plan.validity_days}
                                    </td>
                                    <td className="px-2 py-3 text-gray-700 dark:text-gray-300">
                                        {formatDiscount(plan)}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-gray-600 dark:text-gray-400">
                                        {formatBinding(plan)}
                                    </td>
                                    <td className="px-2 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                plan.is_active
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                        >
                                            {plan.is_active
                                                ? t('dashboard.visitPackages.active', 'РђРєС‚РёРІРµРЅ')
                                                : t('dashboard.visitPackages.inactive', 'РќРµР°РєС‚РёРІРµРЅ')}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/dashboard/visit-packages/${plan.id}`}
                                                className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                            >
                                                {t('dashboard.visitPackages.edit', 'РР·РјРµРЅРёС‚СЊ')}
                                            </Link>
                                            {plan.is_active && (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmPlanId(plan.id)}
                                                    className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                                                >
                                                    {t(
                                                        'dashboard.visitPackages.deactivate',
                                                        'Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ',
                                                    )}
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

            <ConfirmDialog
                open={!!confirmPlanId}
                onClose={() => setConfirmPlanId(null)}
                onConfirm={() => {
                    if (confirmPlanId) {
                        void handleDeactivate(confirmPlanId);
                    }
                }}
                title={t('dashboard.visitPackages.deactivateTitle', 'Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ РїР°РєРµС‚?')}
                message={t(
                    'dashboard.visitPackages.deactivateConfirm',
                    'Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ СЌС‚РѕС‚ С‚РёРї РїР°РєРµС‚Р°?',
                )}
                confirmLabel={t('dashboard.visitPackages.deactivate', 'Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ')}
                cancelLabel={t('common.cancel', 'РћС‚РјРµРЅР°')}
                confirmVariant="danger"
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
