'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type BranchOption = { id: string; name: string };
export type ServiceOption = { id: string; name_ru: string; branch_id: string };

export type VisitPackagePlanFormInitial = {
    id?: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
    validity_days: number;
    discount_type: 'percent' | 'fixed_price';
    discount_value: number;
    service_id: string | null;
    branch_ids: string[] | null;
    is_active?: boolean;
};

type Props = {
    initial: VisitPackagePlanFormInitial;
    branches: BranchOption[];
    services: ServiceOption[];
};

export default function VisitPackagePlanForm({ initial, branches, services }: Props) {
    const router = useRouter();
    const { t } = useLanguage();
    const isEdit = !!initial.id;

    const [form, setForm] = useState<VisitPackagePlanFormInitial>({
        ...initial,
        branch_ids: initial.branch_ids ?? null,
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const allBranchesSelected = useMemo(
        () =>
            (form.branch_ids ?? []).length === branches.length &&
            branches.length > 0,
        [form.branch_ids, branches.length]
    );

    const toggleBranch = (id: string) => {
        setForm((f) => {
            const ids = new Set(f.branch_ids ?? []);
            if (ids.has(id)) ids.delete(id);
            else ids.add(id);
            const next = ids.size === 0 ? null : Array.from(ids);
            return { ...f, branch_ids: next };
        });
    };

    const toggleAllBranches = () => {
        setForm((f) => ({
            ...f,
            branch_ids: allBranchesSelected ? null : branches.map((b) => b.id),
        }));
    };

    const serviceLabel = (s: ServiceOption) => {
        const branch = branches.find((b) => b.id === s.branch_id);
        return branch ? `${s.name_ru} (${branch.name})` : s.name_ru;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(null);
        setSaving(true);
        try {
            const nameRu = form.name_ru.trim();
            if (!nameRu) {
                setErr('Название (русский) обязательно');
                setSaving(false);
                return;
            }
            if (form.visit_count < 1 || form.visit_count > 1000) {
                setErr('Количество визитов: от 1 до 1000');
                setSaving(false);
                return;
            }
            if (form.validity_days < 1 || form.validity_days > 3650) {
                setErr('Срок действия: от 1 до 3650 дней');
                setSaving(false);
                return;
            }
            if (form.discount_type === 'percent' && form.discount_value > 100) {
                setErr('При типе «Процент» значение не должно превышать 100');
                setSaving(false);
                return;
            }
            if (form.discount_value < 0 || form.discount_value > 100000) {
                setErr('Значение скидки: от 0 до 100000');
                setSaving(false);
                return;
            }

            const payload = {
                name_ru: nameRu,
                name_ky: form.name_ky?.trim() || null,
                name_en: form.name_en?.trim() || null,
                visit_count: form.visit_count,
                validity_days: form.validity_days,
                discount_type: form.discount_type,
                discount_value: form.discount_value,
                service_id: form.service_id || null,
                branch_ids: form.branch_ids && form.branch_ids.length > 0 ? form.branch_ids : null,
                ...(isEdit && form.is_active !== undefined ? { is_active: form.is_active } : {}),
            };

            const url = isEdit
                ? `/api/dashboard/visit-package-plans/${initial.id}`
                : '/api/dashboard/visit-package-plans';
            const method = isEdit ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({ ok: false }));
            if (!res.ok || !json?.ok) {
                setErr((json?.message ?? json?.error ?? `HTTP ${res.status}`) as string);
                setSaving(false);
                return;
            }
            router.push('/dashboard/visit-packages');
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Ошибка сохранения');
            setSaving(false);
        }
    };

    return (
        <form data-testid="visit-package-plan-form" onSubmit={handleSubmit} className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <div className="space-y-4">
                <Input
                    label={t('dashboard.visitPackages.form.nameRu', 'Название (русский) *')}
                    value={form.name_ru}
                    onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                    required
                    placeholder="Например: 5 визитов"
                />
                <Input
                    label={t('dashboard.visitPackages.form.nameKy', 'Название (кыргызский)')}
                    value={form.name_ky ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, name_ky: e.target.value || null }))}
                />
                <Input
                    label={t('dashboard.visitPackages.form.nameEn', 'Название (английский)')}
                    value={form.name_en ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value || null }))}
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <Input
                    label={t('dashboard.visitPackages.form.visitCount', 'Количество визитов')}
                    type="number"
                    min={1}
                    max={1000}
                    value={form.visit_count}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, visit_count: Math.max(0, parseInt(String(e.target.value), 10) || 0) }))
                    }
                    required
                />
                <Input
                    label={t('dashboard.visitPackages.form.validityDays', 'Срок действия (дней)')}
                    type="number"
                    min={1}
                    max={3650}
                    value={form.validity_days}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            validity_days: Math.max(0, parseInt(String(e.target.value), 10) || 0),
                        }))
                    }
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('dashboard.visitPackages.form.discountType', 'Тип скидки')}
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="discount_type"
                            checked={form.discount_type === 'percent'}
                            onChange={() => setForm((f) => ({ ...f, discount_type: 'percent' }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {t('dashboard.visitPackages.form.discountPercent', 'Процент')}
                        </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="discount_type"
                            checked={form.discount_type === 'fixed_price'}
                            onChange={() => setForm((f) => ({ ...f, discount_type: 'fixed_price' }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {t('dashboard.visitPackages.form.discountFixed', 'Фиксированная цена за визит')}
                        </span>
                    </label>
                </div>
            </div>

            <Input
                label={t('dashboard.visitPackages.form.discountValue', 'Значение скидки')}
                type="number"
                min={0}
                max={form.discount_type === 'percent' ? 100 : 100000}
                step={form.discount_type === 'percent' ? 1 : 0.01}
                value={form.discount_value}
                onChange={(e) =>
                    setForm((f) => ({
                        ...f,
                        discount_value: Math.max(0, parseFloat(String(e.target.value)) || 0),
                    }))
                }
                required
            />

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('dashboard.visitPackages.form.service', 'Услуга')}
                </label>
                <select
                    value={form.service_id ?? ''}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            service_id: e.target.value || null,
                        }))
                    }
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                    <option value="">{t('dashboard.visitPackages.form.serviceAny', 'Любая услуга')}</option>
                    {services.map((s) => (
                        <option key={s.id} value={s.id}>
                            {serviceLabel(s)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('dashboard.visitPackages.form.branches', 'Филиалы')}
                    </label>
                    <button
                        type="button"
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={toggleAllBranches}
                    >
                        {allBranchesSelected
                            ? t('dashboard.visitPackages.form.branchesClearAll', 'Снять все')
                            : t('dashboard.visitPackages.form.branchesAll', 'Все филиалы')}
                    </button>
                </div>
                <div className="max-h-56 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                    {branches.map((b) => {
                        const checked = (form.branch_ids ?? []).includes(b.id);
                        return (
                            <label
                                key={b.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleBranch(b.id)}
                                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{b.name}</span>
                            </label>
                        );
                    })}
                    {branches.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                            Нет активных филиалов
                        </p>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('dashboard.visitPackages.form.branchesHint', 'Пусто = пакет действует во всех филиалах')}
                </p>
            </div>

            {isEdit && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={form.is_active !== false}
                        onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                        className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Активен (доступен для продажи)
                    </label>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button data-testid="visit-package-plan-submit" type="submit" disabled={saving} isLoading={saving}>
                    {saving
                        ? t('dashboard.visitPackages.form.saving', 'Сохранение…')
                        : t('dashboard.visitPackages.form.save', 'Сохранить')}
                </Button>
                <Link
                    href="/dashboard/visit-packages"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {t('dashboard.visitPackages.form.back', 'Назад к списку')}
                </Link>
            </div>
        </form>
    );
}
