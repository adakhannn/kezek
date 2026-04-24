'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
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
            const activePlans = (json.data.plans as Plan[]).filter((plan) => plan.is_active);
            setPlans(activePlans);
            setSelectedPlanId(activePlans[0]?.id ?? '');
        } catch {
            setPlans([]);
            setError(t('dashboard.visitPackages.loadError', 'Не удалось загрузить список пакетов'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!isOpen) return;
        fetchPlans();
        setSelling(false);
        setError(null);
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
                const message = (json?.message ?? json?.error ?? `HTTP ${res.status}`) as string;
                setError(message);
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

    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
    const discountLabel =
        selectedPlan?.discount_type === 'percent'
            ? `${selectedPlan.discount_value}%`
            : `${selectedPlan?.discount_value ?? ''}`;

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={t('dashboard.visitPackages.sell.title', 'Продать пакет визитов')}
            description={`${t('dashboard.visitPackages.sell.clientLabel', 'Клиент')}: ${clientName}`}
            size="sm"
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t('dashboard.visitPackages.sell.cancel', 'Отмена')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || selling || plans.length === 0}
                        isLoading={selling}
                    >
                        {selling
                            ? t('dashboard.visitPackages.sell.selling', 'Оформление...')
                            : t('dashboard.visitPackages.sell.confirm', 'Продать пакет')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {loading ? (
                    <p className="type-body text-[var(--text-secondary)]">
                        {t('dashboard.integrations.loading', 'Загрузка...')}
                    </p>
                ) : null}

                {error && !loading ? <AlertBanner variant="danger" message={error} /> : null}

                {!loading && plans.length === 0 && !error ? (
                    <EmptyState
                        compact
                        title={t('dashboard.visitPackages.sell.noPlansTitle', 'Нет активных пакетов')}
                        description={t('dashboard.visitPackages.sell.noPlans', 'Нет активных типов пакетов. Создайте пакет в разделе В«Пакеты визитовВ».')}
                    />
                ) : null}

                {!loading && plans.length > 0 ? (
                    <div className="space-y-3">
                        <label className="type-label block text-[var(--text-primary)]">
                            {t('dashboard.visitPackages.sell.choosePlan', 'Выберите тип пакета')}
                        </label>
                        <select
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)]"
                        >
                            {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.name_ru} — {plan.visit_count} визитов, {plan.validity_days} дн.
                                    {plan.discount_type === 'percent' ? `, −${plan.discount_value}%` : `, ${plan.discount_value} за визит`}
                                </option>
                            ))}
                        </select>
                        {selectedPlan ? (
                            <p className="type-caption text-[var(--text-muted)]">
                                {selectedPlan.name_ru}: {selectedPlan.visit_count} визитов, срок {selectedPlan.validity_days} дн., скидка {discountLabel}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Dialog>
    );
}

