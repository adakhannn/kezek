// apps/web/src/app/dashboard/services/ServiceForm.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { validateName, validatePositiveNumber, validatePriceRange } from '@/lib/validation';

type Branch = { id: string; name: string };

type Initial = {
    id?: string;             // если есть — режим редактирования
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_id: string;       // одиночный (используется только в edit)
    branch_ids?: string[];   // множественный (используется только в create)
};

export default function ServiceForm({
                                        initial,
                                        branches,
                                        apiBase,
                                    }: {
    initial: Initial;
    branches: Branch[];
    apiBase: string; // '/api/services'
}) {
    const r = useRouter();
    const { t } = useLanguage();

    const isEdit = !!initial.id;

    const [form, setForm] = useState<Initial>({
        ...initial,
        branch_ids: initial.branch_ids ?? [],
    });

    // Храним цены как строки для удобного редактирования
    const [priceFromStr, setPriceFromStr] = useState<string>(initial.price_from === 0 ? '' : String(initial.price_from));
    const [priceToStr, setPriceToStr] = useState<string>(initial.price_to === 0 ? '' : String(initial.price_to));

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const allSelected = useMemo(
        () => (form.branch_ids ?? []).length === branches.length && branches.length > 0,
        [form.branch_ids, branches.length]
    );

    function toggleBranch(id: string) {
        setForm((f) => {
            const ids = new Set(f.branch_ids ?? []);
            if (ids.has(id)) ids.delete(id);
            else ids.add(id);
            return { ...f, branch_ids: Array.from(ids) };
        });
    }

    function toggleAll() {
        setForm((f) => {
            if (allSelected) return { ...f, branch_ids: [] };
            return { ...f, branch_ids: branches.map((b) => b.id) };
        });
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setErr(null);
        try {
            const url = isEdit
                ? `${apiBase}/${encodeURIComponent(form.id!)}/update`
                : `${apiBase}/create`;

            // валидация
            const nameRuValidation = validateName(form.name_ru.trim());
            if (!nameRuValidation.valid) {
                throw new Error(nameRuValidation.error || t('services.form.error.nameRequired', 'Название обязательно'));
            }

            // Валидация опциональных названий
            if (form.name_ky && form.name_ky.trim()) {
                const nameKyValidation = validateName(form.name_ky.trim(), false);
                if (!nameKyValidation.valid) {
                    throw new Error(t('services.form.error.nameKyInvalid', 'Название (кыргызский) должно содержать минимум 2 символа'));
                }
            }

            if (form.name_en && form.name_en.trim()) {
                const nameEnValidation = validateName(form.name_en.trim(), false);
                if (!nameEnValidation.valid) {
                    throw new Error(t('services.form.error.nameEnInvalid', 'Название (английский) должно содержать минимум 2 символа'));
                }
            }

            // Валидация длительности
            const durationValidation = validatePositiveNumber(form.duration_min, { min: 1, required: true, allowZero: false });
            if (!durationValidation.valid) {
                throw new Error(durationValidation.error || t('services.form.error.durationInvalid', 'Длительность должна быть не менее 1 минуты'));
            }

            // Валидация цен
            const priceFromNum = priceFromStr.trim() === '' ? 0 : Number(priceFromStr) || 0;
            const priceToNum = priceToStr.trim() === '' ? 0 : Number(priceToStr) || 0;

            if (priceFromNum > 0) {
                const priceFromValidation = validatePositiveNumber(priceFromNum, { min: 0, allowZero: false });
                if (!priceFromValidation.valid) {
                    throw new Error(priceFromValidation.error || t('services.form.error.priceFromInvalid', 'Минимальная цена должна быть больше 0'));
                }
            }

            if (priceToNum > 0) {
                const priceToValidation = validatePositiveNumber(priceToNum, { min: 0, allowZero: false });
                if (!priceToValidation.valid) {
                    throw new Error(priceToValidation.error || t('services.form.error.priceToInvalid', 'Максимальная цена должна быть больше 0'));
                }
            }

            // Валидация диапазона цен
            if (priceFromNum > 0 || priceToNum > 0) {
                const rangeValidation = validatePriceRange(priceFromNum, priceToNum);
                if (!rangeValidation.valid) {
                    throw new Error(rangeValidation.error || t('services.form.error.priceRangeInvalid', 'Минимальная цена не может быть больше максимальной'));
                }
            }

            // Валидация филиалов
            const ids = form.branch_ids ?? [];
            if (ids.length === 0) {
                throw new Error(
                    t('services.form.error.branchRequired', 'Выберите хотя бы один филиал'),
                );
            }

            // готовим тело запроса:
            // - create: шлём branch_ids: string[]
            // - edit:   шлём branch_ids: string[] (теперь тоже множественный выбор)
            const payload = {
                name_ru: form.name_ru.trim(),
                name_ky: form.name_ky?.trim() || null,
                name_en: form.name_en?.trim() || null,
                duration_min: Number(form.duration_min) || 0,
                price_from: priceFromStr.trim() === '' ? 0 : Number(priceFromStr) || 0,
                price_to: priceToStr.trim() === '' ? 0 : Number(priceToStr) || 0,
                active: !!form.active,
                ...(isEdit ? { service_id: form.id } : {}),
                branch_ids: form.branch_ids ?? [],
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !j.ok) {
                // Используем message, если есть, иначе error
                setErr(j.message ?? j.error ?? `HTTP_${res.status}`);
                return;
            }
            r.push('/dashboard/services');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <div className="space-y-4">
                <Input
                    label={t('services.form.nameRu', 'Название (русский) *')}
                    value={form.name_ru}
                    onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                    required
                    placeholder={t('services.form.nameRuPlaceholder', 'Взрослая стрижка')}
                />
                <Input
                    label={t('services.form.nameKy', 'Название (кыргызский)')}
                    value={form.name_ky || ''}
                    onChange={(e) => setForm((f) => ({ ...f, name_ky: e.target.value || null }))}
                    placeholder={t('services.form.nameKyPlaceholder', 'Чоңдордун чач кесуү')}
                />
                <Input
                    label={t('services.form.nameEn', 'Название (английский)')}
                    value={form.name_en || ''}
                    onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value || null }))}
                    placeholder={t('services.form.nameEnPlaceholder', 'Adult haircut')}
                />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <Input
                    label={t('services.form.duration', 'Длительность (мин)')}
                    type="number"
                    min={1}
                    value={form.duration_min}
                    onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) || 0 }))}
                    required
                />
                <Input
                    label={t('services.form.priceFrom', 'Цена от')}
                    type="number"
                    min={0}
                    value={priceFromStr}
                    onChange={(e) => {
                        const val = e.target.value;
                        setPriceFromStr(val);
                        // Обновляем form для совместимости
                        setForm((f) => ({ ...f, price_from: val === '' ? 0 : Number(val) || 0 }));
                    }}
                />
                <Input
                    label={t('services.form.priceTo', 'Цена до')}
                    type="number"
                    min={0}
                    value={priceToStr}
                    onChange={(e) => {
                        const val = e.target.value;
                        setPriceToStr(val);
                        // Обновляем form для совместимости
                        setForm((f) => ({ ...f, price_to: val === '' ? 0 : Number(val) || 0 }));
                    }}
                />
            </div>

            {/* Мультивыбор филиалов (для создания и редактирования) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('services.form.branches', 'Филиалы *')}
                    </label>
                    <button
                        type="button"
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={toggleAll}
                    >
                        {allSelected
                            ? t('services.form.branchesClearAll', 'Снять все')
                            : t('services.form.branchesSelectAll', 'Выбрать все')}
                    </button>
                </div>

                <div className="max-h-56 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                    {branches.map((b) => {
                        const checked = (form.branch_ids ?? []).includes(b.id);
                        return (
                            <label key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
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
                        <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                            {t('services.form.noBranches', 'Нет активных филиалов')}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    id="active"
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    {t('services.form.activeLabel', 'Активна (доступна для записи)')}
                </label>
            </div>

            <div className="pt-2">
                <Button type="submit" disabled={saving} isLoading={saving}>
                    {saving
                        ? t('services.form.saving', 'Сохраняем…')
                        : t('services.form.save', 'Сохранить')}
                </Button>
            </div>
        </form>
    );
}
