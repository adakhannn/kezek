// apps/web/src/app/dashboard/services/ServiceForm.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

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
        <form onSubmit={onSubmit} className="space-y-4">
            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div>
                <label className="block text-sm text-gray-600 mb-1">Название *</label>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={form.name_ru}
                    onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                    required
                />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Длительность (мин) *</label>
                    <input
                        type="number"
                        min={1}
                        className="border rounded px-3 py-2 w-full"
                        value={form.duration_min}
                        onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Цена от *</label>
                    <input
                        type="number"
                        min={0}
                        className="border rounded px-3 py-2 w-full"
                        value={form.price_from}
                        onChange={(e) => setForm((f) => ({ ...f, price_from: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Цена до *</label>
                    <input
                        type="number"
                        min={0}
                        className="border rounded px-3 py-2 w-full"
                        value={form.price_to}
                        onChange={(e) => setForm((f) => ({ ...f, price_to: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
            </div>

            {/* Ветвление по режимам */}
            {!isEdit ? (
                // CREATE: мультивыбор филиалов
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-600">Филиалы *</label>
                        <button
                            type="button"
                            className="text-xs underline"
                            onClick={toggleAll}
                        >
                            {allSelected ? 'Снять все' : 'Выбрать все'}
                        </button>
                    </div>

                    <div className="max-h-56 overflow-auto border rounded p-2">
                        {branches.map((b) => {
                            const checked = (form.branch_ids ?? []).includes(b.id);
                            return (
                                <label key={b.id} className="flex items-center gap-2 py-1">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleBranch(b.id)}
                                    />
                                    <span>{b.name}</span>
                                </label>
                            );
                        })}
                        {branches.length === 0 && (
                            <div className="text-sm text-gray-500">Нет активных филиалов</div>
                        )}
                    </div>
                </div>
            ) : (
                // EDIT: одиночный выбор (зафиксированный филиал)
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Филиал</label>
                        <input
                            className="border rounded px-3 py-2 w-full bg-gray-50"
                            value={branches.find((b) => b.id === form.branch_id)?.name ?? form.branch_id}
                            readOnly
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2">
                <input
                    id="active"
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                <label htmlFor="active">Активна (доступна для записи)</label>
            </div>

            <div className="flex gap-2">
                <button disabled={saving} className="border rounded px-4 py-2">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
