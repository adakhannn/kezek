// apps/web/src/app/dashboard/branches/[id]/BranchPromotionsPanel.tsx
'use client';

import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import {logError} from '@/lib/log';

type PromotionType = 'free_after_n_visits' | 'referral_free' | 'referral_discount_50' | 'birthday_discount' | 'first_visit_discount';

type Promotion = {
    id: string;
    promotion_type: PromotionType;
    params: Record<string, unknown>;
    title_ru: string;
    title_ky?: string | null;
    title_en?: string | null;
    description_ru?: string | null;
    description_ky?: string | null;
    description_en?: string | null;
    is_active: boolean;
    valid_from?: string | null;
    valid_to?: string | null;
    created_at: string;
    usage_count?: number;
};

// PROMOTION_TYPES будут переведены динамически через useLanguage
const PROMOTION_TYPE_KEYS: Array<{ value: PromotionType; labelKey: string; descKey: string }> = [
    { value: 'free_after_n_visits', labelKey: 'branches.promotions.type.freeAfterNVisits', descKey: 'branches.promotions.type.freeAfterNVisitsDesc' },
    { value: 'referral_free', labelKey: 'branches.promotions.type.referralFree', descKey: 'branches.promotions.type.referralFreeDesc' },
    { value: 'referral_discount_50', labelKey: 'branches.promotions.type.referralDiscount50', descKey: 'branches.promotions.type.referralDiscount50Desc' },
    { value: 'first_visit_discount', labelKey: 'branches.promotions.type.firstVisitDiscount', descKey: 'branches.promotions.type.firstVisitDiscountDesc' },
];

export default function BranchPromotionsPanel({ branchId, bizSlug }: { branchId: string; bizSlug?: string }) {
    const { t } = useLanguage();
    const toast = useToast();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const [formData, setFormData] = useState<{
        promotion_type: PromotionType;
        params: Record<string, unknown>;
        title_ru: string;
        is_active: boolean;
        valid_from?: string | null;
        valid_to?: string | null;
    }>({
        promotion_type: 'free_after_n_visits',
        params: { visit_count: null },
        title_ru: '',
        is_active: true,
        valid_from: null,
        valid_to: null,
    });

    useEffect(() => {
        loadPromotions();
    }, [branchId]);

    async function loadPromotions() {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/branches/${branchId}/promotions`);
            const data = await res.json();
            if (data.ok) {
                setPromotions(data.promotions || []);
            } else {
                logError('BranchPromotions', 'Failed to load promotions', { error: data.error });
                toast.showError(data.error || t('branches.promotions.error.load', 'Ошибка загрузки акций'));
            }
        } catch (error) {
            logError('BranchPromotions', 'Failed to load promotions', error);
            toast.showError(t('branches.promotions.error.load', 'Ошибка загрузки акций'));
        } finally {
            setLoading(false);
        }
    }

    function startEdit(promotion: Promotion) {
        setFormData({
            promotion_type: promotion.promotion_type,
            params: promotion.params || {},
            title_ru: promotion.title_ru,
            is_active: promotion.is_active,
            valid_from: promotion.valid_from || null,
            valid_to: promotion.valid_to || null,
        });
        setEditingId(promotion.id);
        setShowForm(true);
    }

    function startCreate() {
        setFormData({
            promotion_type: 'free_after_n_visits',
            params: { visit_count: null },
            title_ru: '',
            is_active: true,
            valid_from: null,
            valid_to: null,
        });
        setEditingId(null);
        setShowForm(true);
    }

    function cancelForm() {
        setShowForm(false);
        setEditingId(null);
    }

    async function savePromotion() {
        try {
            // Если название не указано, используем название типа акции
            const title_ru = formData.title_ru.trim() || (selectedTypeKey ? t(selectedTypeKey.labelKey, '') : '');
            
            // Устанавливаем значения по умолчанию, если они не указаны
            let params = { ...formData.params };
            if (formData.promotion_type === 'free_after_n_visits' && !params.visit_count) {
                params.visit_count = 7;
            }
            if ((formData.promotion_type === 'birthday_discount' || formData.promotion_type === 'first_visit_discount') && !params.discount_percent) {
                params.discount_percent = 20;
            }
            if (formData.promotion_type === 'referral_discount_50' && !params.discount_percent) {
                params.discount_percent = 50;
            }
            
            const url = editingId
                ? `/api/dashboard/branches/${branchId}/promotions/${editingId}`
                : `/api/dashboard/branches/${branchId}/promotions`;
            const method = editingId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    title_ru,
                    params,
                }),
            });

            const data = await res.json();
            if (data.ok) {
                setConfirmDeleteId(null);
                toast.showSuccess(editingId ? t('branches.promotions.save.success', 'Акция обновлена') : t('branches.promotions.create.success', 'Акция создана'));
                loadPromotions();
                cancelForm();
            } else {
                toast.showError(data.error || t('branches.promotions.error.save', 'Ошибка сохранения акции'));
            }
        } catch (error) {
            logError('BranchPromotions', 'Failed to save promotion', error);
            toast.showError(t('branches.promotions.error.save', 'Ошибка сохранения акции'));
        }
    }

    async function deletePromotion(id: string) {
        try {
            const res = await fetch(`/api/dashboard/branches/${branchId}/promotions/${id}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.ok) {
                setConfirmDeleteId(null);
                toast.showSuccess(t('branches.promotions.delete.success', 'Акция удалена'));
                loadPromotions();
            } else {
                toast.showError(data.error || t('branches.promotions.error.delete', 'Ошибка удаления акции'));
            }
        } catch (error) {
            logError('BranchPromotions', 'Failed to delete promotion', error);
            toast.showError(t('branches.promotions.error.delete', 'Ошибка удаления акции'));
        }
    }

    function toggleActive(id: string, currentStatus: boolean) {
        fetch(`/api/dashboard/branches/${branchId}/promotions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.ok) {
                    loadPromotions();
                } else {
                    toast.showError(data.error || t('branches.promotions.error.update', 'Ошибка обновления акции'));
                }
            })
            .catch((error) => {
                logError('BranchPromotions', 'Failed to toggle promotion', error);
                toast.showError(t('branches.promotions.error.update', 'Ошибка обновления акции'));
            });
    }

    const selectedTypeKey = PROMOTION_TYPE_KEYS.find((k) => k.value === formData.promotion_type);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-[#101827] to-slate-950 shadow-[0_20px_55px_-42px_rgba(129,140,248,0.7)]">
            <div className="flex flex-col gap-5 border-b border-white/10 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300">
                        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v8H4v-8m16 0H4m16 0h1V8h-5.5M4 12H3V8h5.5M12 8v12m0-12H8.5a2.5 2.5 0 1 1 2.5-2.5V8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5V8Z" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-white sm:text-2xl">
                        {t('branches.promotions.title', 'Акции филиала')}
                        </h2>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                            {t('branches.promotions.subtitle', 'Управление акциями и специальными предложениями')}
                        </p>
                    </div>
                </div>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {!showForm && bizSlug && (
                        <a
                            href={`/b/${bizSlug}/promotions`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-400/35 bg-indigo-400/5 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:border-indigo-300/60 hover:bg-indigo-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                            <svg aria-hidden="true" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {t('branches.promotions.viewAsClient', 'Посмотреть как клиент')}
                        </a>
                    )}
                    {!showForm && (
                        <Button
                            onClick={startCreate}
                            className="min-h-10 justify-center rounded-xl px-4 shadow-[0_10px_24px_-14px_rgba(236,72,153,0.9)]"
                            leadingIcon={(
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        >
                            {t('branches.promotions.add', 'Добавить акцию')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
            {showForm ? (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {editingId ? t('branches.promotions.edit.title', 'Редактирование акции') : t('branches.promotions.create.title', 'Создание акции')}
                    </h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('branches.promotions.type.label', 'Тип акции *')}
                        </label>
                        <select
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.promotion_type}
                            onChange={(e) => {
                                const newType = e.target.value as PromotionType;
                                const newParams: Record<string, unknown> = {};
                                if (newType === 'free_after_n_visits') {
                                    newParams.visit_count = null;
                                } else if (newType === 'birthday_discount' || newType === 'first_visit_discount' || newType === 'referral_discount_50') {
                                    newParams.discount_percent = newType === 'referral_discount_50' ? 50 : 20;
                                }
                                setFormData((f) => ({ ...f, promotion_type: newType, params: newParams }));
                            }}
                        >
                            {PROMOTION_TYPE_KEYS.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {t(type.labelKey, type.value)}
                                </option>
                            ))}
                        </select>
                        {selectedTypeKey && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t(selectedTypeKey.descKey, '')}
                            </p>
                        )}
                    </div>

                    {formData.promotion_type === 'free_after_n_visits' && (
                        <Input
                            label={t('branches.promotions.visitCount.label', 'Количество посещений (N)')}
                            type="number"
                            min={1}
                            value={(formData.params.visit_count as number) || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                const num = val === '' ? null : Number(val);
                                setFormData((f) => ({
                                    ...f,
                                    params: { ...f.params, visit_count: num || null },
                                }));
                            }}
                            helperText={t('branches.promotions.visitCount.help', 'Каждая N-я услуга будет бесплатной (например, 7-я)')}
                        />
                    )}

                    {(formData.promotion_type === 'birthday_discount' || formData.promotion_type === 'first_visit_discount' || formData.promotion_type === 'referral_discount_50') && (
                        <Input
                            label={t('branches.promotions.discountPercent.label', 'Процент скидки')}
                            type="number"
                            min={1}
                            max={100}
                            value={(formData.params.discount_percent as number) ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                const num = val === '' ? null : (Number(val) || null);
                                setFormData((f) => ({
                                    ...f,
                                    params: { ...f.params, discount_percent: num },
                                }));
                            }}
                            helperText={t('branches.promotions.discountPercent.help', 'Размер скидки в процентах (1-100)')}
                        />
                    )}

                    <Input
                        label={t('branches.promotions.titleRu.label', 'Название акции (русский)')}
                        value={formData.title_ru}
                        onChange={(e) => setFormData((f) => ({ ...f, title_ru: e.target.value }))}
                        placeholder={t('branches.promotions.titleRu.placeholder', 'Опционально. Если не указано, будет использовано название типа акции')}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label={t('branches.promotions.validFrom.label', 'Дата начала (опционально)')}
                            type="date"
                            value={formData.valid_from || ''}
                            onChange={(e) => setFormData((f) => ({ ...f, valid_from: e.target.value || null }))}
                        />
                        <Input
                            label={t('branches.promotions.validTo.label', 'Дата окончания (опционально)')}
                            type="date"
                            value={formData.valid_to || ''}
                            onChange={(e) => setFormData((f) => ({ ...f, valid_to: e.target.value || null }))}
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData((f) => ({ ...f, is_active: e.target.checked }))}
                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            {t('branches.promotions.isActive.label', 'Активна (отображается клиентам)')}
                        </label>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={savePromotion}>
                            {editingId ? t('branches.promotions.save', 'Сохранить') : t('branches.promotions.create', 'Создать')}
                        </Button>
                        <Button variant="secondary" onClick={cancelForm}>
                            {t('branches.promotions.cancel', 'Отмена')}
                        </Button>
                    </div>
                </div>
            ) : null}

            {!showForm && (loading ? (
                <div className="grid min-h-56 place-items-center rounded-2xl border border-white/10 bg-white/[0.025]" aria-live="polite">
                    <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
                        <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-300/25 border-t-indigo-300" aria-hidden="true" />
                        {t('branches.promotions.loading', 'Загрузка...')}
                    </div>
                </div>
            ) : promotions.length === 0 ? (
                <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border border-dashed border-indigo-400/25 bg-gradient-to-br from-indigo-400/[0.07] via-transparent to-fuchsia-400/[0.06] px-5 py-9 text-center">
                    <div aria-hidden="true" className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="relative mx-auto max-w-md">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-indigo-200 shadow-lg shadow-indigo-950/20">
                            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m7 12 3 3 7-7M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                            </svg>
                        </span>
                        <h3 className="mt-4 text-lg font-semibold text-white">
                            {t('branches.promotions.emptyTitle')}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            {t('branches.promotions.emptyDescription')}
                        </p>
                        <Button
                            onClick={startCreate}
                            className="mt-5 min-h-10 rounded-xl px-5"
                            leadingIcon={(
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        >
                            {t('branches.promotions.emptyAction')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {promotions.map((promotion) => {
                        const typeKey = PROMOTION_TYPE_KEYS.find((k) => k.value === promotion.promotion_type);
                        const typeLabel = typeKey ? t(typeKey.labelKey, promotion.promotion_type) : promotion.promotion_type;
                        const params = promotion.params || {};

                        return (
                            <div
                                key={promotion.id}
                                className={`p-3 sm:p-4 rounded-lg border ${
                                    promotion.is_active
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                    <div className="flex-1 space-y-2 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate flex-1 min-w-0">{promotion.title_ru}</h4>
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                                    promotion.is_active
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                }`}
                                            >
                                                {promotion.is_active ? t('branches.promotions.status.active', 'Активна') : t('branches.promotions.status.inactive', 'Неактивна')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{typeLabel}</p>
                                        {promotion.promotion_type === 'free_after_n_visits' && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {t('branches.promotions.everyNthFree', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count || 'N'))}
                                            </p>
                                        )}
                                        {(promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {t('branches.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent || 'N'))}
                                            </p>
                                        )}
                                        {(promotion.valid_from || promotion.valid_to) && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {t('branches.promotions.validPeriod', 'Действует: {from} — {to}')
                                                    .replace('{from}', promotion.valid_from || t('branches.promotions.validPeriod.from', 'с начала'))
                                                    .replace('{to}', promotion.valid_to || t('branches.promotions.validPeriod.to', 'без ограничений'))}
                                            </p>
                                        )}
                                        {typeof promotion.usage_count === 'number' && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                                    {t('branches.promotions.usageCount', 'Использовано: {count} раз').replace('{count}', String(promotion.usage_count))}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:flex-col">
                                        <button
                                            onClick={() => toggleActive(promotion.id, promotion.is_active)}
                                            className="flex-1 sm:flex-none px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all shadow-sm"
                                        >
                                            {promotion.is_active ? t('branches.promotions.deactivate', 'Деактив.') : t('branches.promotions.activate', 'Актив.')}
                                        </button>
                                        <button
                                            onClick={() => startEdit(promotion)}
                                            className="flex-1 sm:flex-none px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all shadow-sm"
                                        >
                                            {t('branches.promotions.edit', 'Редакт.')}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(promotion.id)}
                                            className="flex-1 sm:flex-none px-3 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 active:bg-red-200 dark:active:bg-red-900/40 transition-all shadow-sm"
                                        >
                                            {t('branches.promotions.delete', 'Удалить')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
            </div>
            <ConfirmDialog
                open={confirmDeleteId !== null}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={() => confirmDeleteId && deletePromotion(confirmDeleteId)}
                title={t('branches.promotions.delete.title', 'Delete promotion')}
                message={t('branches.promotions.delete.confirm', 'Delete promotion?')}
                confirmLabel={t('branches.promotions.delete.action', 'Delete')}
                cancelLabel={t('common.cancel', 'Cancel')}
                confirmVariant="danger"
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </section>
    );
}


