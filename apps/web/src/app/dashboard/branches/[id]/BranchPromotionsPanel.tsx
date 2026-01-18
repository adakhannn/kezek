// apps/web/src/app/dashboard/branches/[id]/BranchPromotionsPanel.tsx
'use client';

import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
};

// PROMOTION_TYPES будут переведены динамически через useLanguage
const PROMOTION_TYPE_KEYS: Array<{ value: PromotionType; labelKey: string; descKey: string }> = [
    { value: 'free_after_n_visits', labelKey: 'branches.promotions.type.freeAfterNVisits', descKey: 'branches.promotions.type.freeAfterNVisitsDesc' },
    { value: 'referral_free', labelKey: 'branches.promotions.type.referralFree', descKey: 'branches.promotions.type.referralFreeDesc' },
    { value: 'referral_discount_50', labelKey: 'branches.promotions.type.referralDiscount50', descKey: 'branches.promotions.type.referralDiscount50Desc' },
    { value: 'first_visit_discount', labelKey: 'branches.promotions.type.firstVisitDiscount', descKey: 'branches.promotions.type.firstVisitDiscountDesc' },
];

export default function BranchPromotionsPanel({ branchId }: { branchId: string }) {
    const { t } = useLanguage();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

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
                console.error('Failed to load promotions:', data.error);
                alert(data.error || t('branches.promotions.error.load', 'Ошибка загрузки акций'));
            }
        } catch (error) {
            console.error('Failed to load promotions:', error);
            alert(t('branches.promotions.error.load', 'Ошибка загрузки акций'));
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
                alert(editingId ? t('branches.promotions.save.success', 'Акция обновлена') : t('branches.promotions.create.success', 'Акция создана'));
                loadPromotions();
                cancelForm();
            } else {
                alert(data.error || t('branches.promotions.error.save', 'Ошибка сохранения акции'));
            }
        } catch (error) {
            console.error('Failed to save promotion:', error);
            alert(t('branches.promotions.error.save', 'Ошибка сохранения акции'));
        }
    }

    async function deletePromotion(id: string) {
        if (!confirm(t('branches.promotions.delete.confirm', 'Удалить акцию?'))) return;

        try {
            const res = await fetch(`/api/dashboard/branches/${branchId}/promotions/${id}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.ok) {
                alert(t('branches.promotions.delete.success', 'Акция удалена'));
                loadPromotions();
            } else {
                alert(data.error || t('branches.promotions.error.delete', 'Ошибка удаления акции'));
            }
        } catch (error) {
            console.error('Failed to delete promotion:', error);
            alert(t('branches.promotions.error.delete', 'Ошибка удаления акции'));
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
                    alert(data.error || t('branches.promotions.error.update', 'Ошибка обновления акции'));
                }
            })
            .catch((error) => {
                console.error('Failed to toggle promotion:', error);
                alert(t('branches.promotions.error.update', 'Ошибка обновления акции'));
            });
    }

    const selectedTypeKey = PROMOTION_TYPE_KEYS.find((k) => k.value === formData.promotion_type);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {t('branches.promotions.title', 'Акции филиала')}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('branches.promotions.subtitle', 'Управление акциями и специальными предложениями')}
                    </p>
                </div>
                {!showForm && (
                    <Button onClick={startCreate} size="sm">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('branches.promotions.add', 'Добавить акцию')}
                    </Button>
                )}
            </div>

            {showForm ? (
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
                            value={(formData.params.discount_percent as number) || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                const num = val === '' ? null : Number(val);
                                setFormData((f) => ({
                                    ...f,
                                    params: { ...f.params, discount_percent: num || null },
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

                    <div className="grid grid-cols-2 gap-4">
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

            {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('branches.promotions.loading', 'Загрузка...')}</div>
            ) : promotions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('branches.promotions.empty', 'Нет акций. Добавьте первую акцию.')}
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
                                className={`p-4 rounded-lg border ${
                                    promotion.is_active
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{promotion.title_ru}</h4>
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleActive(promotion.id, promotion.is_active)}
                                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                        >
                                            {promotion.is_active ? t('branches.promotions.deactivate', 'Деактив.') : t('branches.promotions.activate', 'Актив.')}
                                        </button>
                                        <button
                                            onClick={() => startEdit(promotion)}
                                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                        >
                                            {t('branches.promotions.edit', 'Редакт.')}
                                        </button>
                                        <button
                                            onClick={() => deletePromotion(promotion.id)}
                                            className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                                        >
                                            {t('branches.promotions.delete', 'Удалить')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

