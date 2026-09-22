// apps/web/src/app/dashboard/services/ServiceForm.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { validateName } from '@/lib/validation';

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

type ServiceFormState = Omit<Initial, 'duration_min'> & {
    duration_min: string;
};

type ServiceFieldErrors = Partial<Record<'nameRu' | 'nameKy' | 'nameEn' | 'duration' | 'priceFrom' | 'priceTo' | 'branches', string>>;

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

    const [form, setForm] = useState<ServiceFormState>({
        ...initial,
        duration_min: initial.duration_min > 0 ? String(initial.duration_min) : '',
        branch_ids: initial.branch_ids ?? [],
    });

    // Храним цены как строки для удобного редактирования
    const [priceFromStr, setPriceFromStr] = useState<string>(initial.price_from === 0 ? '' : String(initial.price_from));
    const [priceToStr, setPriceToStr] = useState<string>(initial.price_to === 0 ? '' : String(initial.price_to));

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<ServiceFieldErrors>({});

    const allSelected = useMemo(
        () => (form.branch_ids ?? []).length === branches.length && branches.length > 0,
        [form.branch_ids, branches.length]
    );

    function toggleBranch(id: string) {
        setFieldErrors((errors) => ({ ...errors, branches: undefined }));
        setForm((f) => {
            const ids = new Set(f.branch_ids ?? []);
            if (ids.has(id)) ids.delete(id);
            else ids.add(id);
            return { ...f, branch_ids: Array.from(ids) };
        });
    }

    function toggleAll() {
        setFieldErrors((errors) => ({ ...errors, branches: undefined }));
        setForm((f) => {
            if (allSelected) return { ...f, branch_ids: [] };
            return { ...f, branch_ids: branches.map((b) => b.id) };
        });
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        setFieldErrors({});

        const validationErrors: ServiceFieldErrors = {};
        const nameRu = form.name_ru.trim();
        const nameKy = form.name_ky?.trim() ?? '';
        const nameEn = form.name_en?.trim() ?? '';
        const durationMin = form.duration_min.trim();
        const duration = Number(durationMin);
        const priceFromRaw = priceFromStr.trim();
        const priceToRaw = priceToStr.trim();
        const priceFromNum = priceFromRaw === '' ? 0 : Number(priceFromRaw);
        const priceToNum = priceToRaw === '' ? 0 : Number(priceToRaw);

        if (!nameRu) {
            validationErrors.nameRu = t('services.form.error.nameRequired', 'Название обязательно');
        } else if (!validateName(nameRu).valid) {
            validationErrors.nameRu = t('services.form.error.nameRuInvalid', 'Введите не менее 2 символов');
        }

        if (nameKy && !validateName(nameKy, false).valid) {
            validationErrors.nameKy = t('services.form.error.nameKyInvalid', 'Введите не менее 2 символов');
        }

        if (nameEn && !validateName(nameEn, false).valid) {
            validationErrors.nameEn = t('services.form.error.nameEnInvalid', 'Введите не менее 2 символов');
        }

        if (!Number.isInteger(duration) || duration < 1) {
            validationErrors.duration = t('services.form.error.durationInvalid', 'Укажите целое число не менее 1 минуты');
        }

        if (!Number.isFinite(priceFromNum) || priceFromNum < 0) {
            validationErrors.priceFrom = t('services.form.error.priceInvalid', 'Цена не может быть отрицательной');
        }

        if (!Number.isFinite(priceToNum) || priceToNum < 0) {
            validationErrors.priceTo = t('services.form.error.priceInvalid', 'Цена не может быть отрицательной');
        }

        if (!validationErrors.priceFrom && !validationErrors.priceTo && priceFromNum > 0 && priceToNum > 0 && priceFromNum > priceToNum) {
            validationErrors.priceTo = t('services.form.error.priceRangeInvalid', 'Минимальная цена не может быть больше максимальной');
        }

        if ((form.branch_ids ?? []).length === 0) {
            validationErrors.branches = t('services.form.error.branchRequired', 'Выберите хотя бы один филиал');
        }

        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            setErr(t('services.form.error.fixFields', 'Проверьте выделенные поля'));
            return;
        }

        setSaving(true);
        try {
            const url = isEdit
                ? `${apiBase}/${encodeURIComponent(form.id!)}/update`
                : `${apiBase}/create`;

            // готовим тело запроса:
            // - create: шлём branch_ids: string[]
            // - edit:   шлём branch_ids: string[] (теперь тоже множественный выбор)
            const payload = {
                name_ru: nameRu,
                name_ky: nameKy || null,
                name_en: nameEn || null,
                duration_min: duration,
                price_from: priceFromNum,
                price_to: priceToNum,
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
        <form noValidate onSubmit={onSubmit} className="space-y-6">
            {err && (
                <AlertBanner variant="danger" message={err} compact />
            )}

            <div className="space-y-4">
                <Input
                    label={t('services.form.nameRu', 'Название (русский) *')}
                    value={form.name_ru}
                    onChange={(e) => {
                        setForm((f) => ({ ...f, name_ru: e.target.value }));
                        setFieldErrors((errors) => ({ ...errors, nameRu: undefined }));
                    }}
                    required
                    error={fieldErrors.nameRu}
                    placeholder={t('services.form.nameRuPlaceholder', 'Взрослая стрижка')}
                />
                <Input
                    label={t('services.form.nameKy', 'Название (кыргызский)')}
                    value={form.name_ky || ''}
                    onChange={(e) => {
                        setForm((f) => ({ ...f, name_ky: e.target.value || null }));
                        setFieldErrors((errors) => ({ ...errors, nameKy: undefined }));
                    }}
                    error={fieldErrors.nameKy}
                    placeholder={t('services.form.nameKyPlaceholder', 'Чоңдордун чач кесуү')}
                />
                <Input
                    label={t('services.form.nameEn', 'Название (английский)')}
                    value={form.name_en || ''}
                    onChange={(e) => {
                        setForm((f) => ({ ...f, name_en: e.target.value || null }));
                        setFieldErrors((errors) => ({ ...errors, nameEn: undefined }));
                    }}
                    error={fieldErrors.nameEn}
                    placeholder={t('services.form.nameEnPlaceholder', 'Adult haircut')}
                />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <Input
                    label={t('services.form.duration', 'Длительность (мин)')}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={form.duration_min}
                    onChange={(e) => {
                        const value = e.target.value.replace(/^0+(?=\d)/, '');
                        setForm((f) => ({
                            ...f,
                            duration_min: value,
                        }));
                        setFieldErrors((errors) => ({ ...errors, duration: undefined }));
                    }}
                    required
                    error={fieldErrors.duration}
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
                        setFieldErrors((errors) => ({ ...errors, priceFrom: undefined, priceTo: undefined }));
                    }}
                    error={fieldErrors.priceFrom}
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
                        setFieldErrors((errors) => ({ ...errors, priceFrom: undefined, priceTo: undefined }));
                    }}
                    error={fieldErrors.priceTo}
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
                {fieldErrors.branches && <p role="alert" className="type-caption text-[var(--status-danger)]">{fieldErrors.branches}</p>}
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
