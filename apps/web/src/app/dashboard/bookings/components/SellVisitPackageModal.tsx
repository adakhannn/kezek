'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';

type Plan = {
    id: string;
    name_ru: string;
    visit_count: number;
    validity_days: number;
    discount_type: string;
    discount_value: number;
    is_active: boolean;
};

type SellVisitPackageModalProps = {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    onSuccess?: () => void;
};

export function SellVisitPackageModal({
    isOpen,
    onClose,
    clientId,
    clientName,
    onSuccess,
}: SellVisitPackageModalProps) {
    const { t } = useLanguage();
    const toast = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(false);
    const [selling, setSelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/visit-package-plans', { cache: 'no-store' });
            const json = await res.json();
            if (!json?.ok || !Array.isArray(json?.data?.plans)) {
                setPlans([]);
                setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список пакетов'));
                return;
            }
            const active = (json.data.plans as Plan[]).filter((p) => p.is_active);
            setPlans(active);
            setSelectedPlanId(active[0]?.id ?? '');
        } catch {
            setPlans([]);
            setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список пакетов'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (isOpen) {
            fetchPlans();
            setSelling(false);
            setError(null);
        }
    }, [isOpen, fetchPlans]);

    const handleSubmit = async () => {
        if (!selectedPlanId) {
            toast.showError(t('dashboard.visitPackages.sell.selectPlan', 'Выберите пакет'));
            return;
        }
        setSelling(true);
        setError(null);
        try {
            const res = await fetch(`/api/dashboard/clients/${clientId}/visit-packages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: selectedPlanId }),
            });
            const json = await res.json();
            if (!res.ok || !json?.ok) {
                const msg = (json?.message ?? json?.error ?? `HTTP ${res.status}`) as string;
                setError(msg);
                setSelling(false);
                return;
            }
            toast.showSuccess(t('dashboard.visitPackages.sell.success', 'Пакет успешно продан'));
            onSuccess?.();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка');
            setSelling(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    const discountLabel =
        selectedPlan?.discount_type === 'percent'
            ? `${selectedPlan?.discount_value}%`
            : `${selectedPlan?.discount_value}`;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('dashboard.visitPackages.sell.title', 'Продать пакет визитов')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('dashboard.visitPackages.sell.clientLabel', 'Клиент')}: {clientName}
                    </p>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    {loading && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.integrations.loading', 'Загрузка...')}
                        </p>
                    )}
                    {error && !loading && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
                    )}
                    {!loading && plans.length === 0 && !error && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.visitPackages.sell.noPlans', 'Нет активных типов пакетов. Создайте пакет в разделе «Пакеты визитов».')}
                        </p>
                    )}
                    {!loading && plans.length > 0 && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('dashboard.visitPackages.sell.choosePlan', 'Выберите тип пакета')}
                            </label>
                            <select
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                            >
                                {plans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name_ru} — {p.visit_count} визитов, {p.validity_days} дн.
                                        {p.discount_type === 'percent' ? `, −${p.discount_value}%` : `, ${p.discount_value} за визит`}
                                    </option>
                                ))}
                            </select>
                            {selectedPlan && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {selectedPlan.name_ru}: {selectedPlan.visit_count} визитов, срок {selectedPlan.validity_days} дн., скидка {discountLabel}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t('dashboard.visitPackages.sell.cancel', 'Отмена')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || selling || plans.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {selling && (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        {selling
                            ? t('dashboard.visitPackages.sell.selling', 'Оформление...')
                            : t('dashboard.visitPackages.sell.confirm', 'Продать пакет')}
                    </button>
                </div>
            </div>
        </div>
    );
}
