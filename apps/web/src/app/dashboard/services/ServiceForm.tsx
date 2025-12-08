// apps/web/src/app/dashboard/services/ServiceForm.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Branch = { id: string; name: string };

type Initial = {
    id?: string;             // если есть — режим редактирования
    name_ru: string;
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

    const isEdit = !!initial.id;

    const [form, setForm] = useState<Initial>({
        ...initial,
        branch_ids: initial.branch_ids ?? [],
    });

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
            if (!form.name_ru.trim()) {
                throw new Error('Название обязательно');
            }
            if (!isEdit) {
                const ids = form.branch_ids ?? [];
                if (ids.length === 0) throw new Error('Выберите хотя бы один филиал');
            } else {
                if (!form.branch_id) throw new Error('Не указан филиал для редактирования услуги');
            }

            // готовим тело запроса:
            // - create: шлём branch_ids: string[]
            // - edit:   шлём branch_id: string
            const payload = isEdit
                ? {
                    name_ru: form.name_ru.trim(),
                    duration_min: Number(form.duration_min) || 0,
                    price_from: Number(form.price_from) || 0,
                    price_to: Number(form.price_to) || 0,
                    active: !!form.active,
                    branch_id: form.branch_id,               // один
                }
                : {
                    name_ru: form.name_ru.trim(),
                    duration_min: Number(form.duration_min) || 0,
                    price_from: Number(form.price_from) || 0,
                    price_to: Number(form.price_to) || 0,
                    active: !!form.active,
                    branch_ids: form.branch_ids ?? [],       // много
                };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !j.ok) {
                setErr(j.error ?? `HTTP_${res.status}`);
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

            <Input
                label="Название"
                value={form.name_ru}
                onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                required
            />

            <div className="grid sm:grid-cols-3 gap-4">
                <Input
                    label="Длительность (мин)"
                    type="number"
                    min={1}
                    value={form.duration_min}
                    onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) || 0 }))}
                    required
                />
                <Input
                    label="Цена от"
                    type="number"
                    min={0}
                    value={form.price_from}
                    onChange={(e) => setForm((f) => ({ ...f, price_from: Number(e.target.value) || 0 }))}
                    required
                />
                <Input
                    label="Цена до"
                    type="number"
                    min={0}
                    value={form.price_to}
                    onChange={(e) => setForm((f) => ({ ...f, price_to: Number(e.target.value) || 0 }))}
                    required
                />
            </div>

            {/* Ветвление по режимам */}
            {!isEdit ? (
                // CREATE: мультивыбор филиалов
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Филиалы *</label>
                        <button
                            type="button"
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={toggleAll}
                        >
                            {allSelected ? 'Снять все' : 'Выбрать все'}
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
                            <div className="text-sm text-gray-500 dark:text-gray-400 p-2">Нет активных филиалов</div>
                        )}
                    </div>
                </div>
            ) : (
                // EDIT: одиночный выбор (зафиксированный филиал)
                <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                        label="Филиал"
                        value={branches.find((b) => b.id === form.branch_id)?.name ?? form.branch_id}
                        readOnly
                        className="bg-gray-50 dark:bg-gray-800"
                    />
                </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    id="active"
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Активна (доступна для записи)
                </label>
            </div>

            <div className="pt-2">
                <Button type="submit" disabled={saving} isLoading={saving}>
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </Button>
            </div>
        </form>
    );
}
