'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Branch = { id: string; name: string };

type Initial = {
    id?: string;
    name_ru: string;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_id: string;
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
    const [form, setForm] = useState<Initial>(initial);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true); setErr(null);
        try {
            const url = form.id
                ? `${apiBase}/${encodeURIComponent(form.id)}/update`
                : `${apiBase}/create`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify(form),
            });
            const payload = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !payload.ok) {
                setErr(payload.error ?? `HTTP_${res.status}`);
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
                    onChange={(e)=>setForm(f=>({...f, name_ru: e.target.value }))}
                    required
                />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Длительность (мин) *</label>
                    <input
                        type="number" min={1}
                        className="border rounded px-3 py-2 w-full"
                        value={form.duration_min}
                        onChange={(e)=>setForm(f=>({...f, duration_min: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Цена от *</label>
                    <input
                        type="number" min={0}
                        className="border rounded px-3 py-2 w-full"
                        value={form.price_from}
                        onChange={(e)=>setForm(f=>({...f, price_from: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Цена до *</label>
                    <input
                        type="number" min={0}
                        className="border rounded px-3 py-2 w-full"
                        value={form.price_to}
                        onChange={(e)=>setForm(f=>({...f, price_to: Number(e.target.value) || 0 }))}
                        required
                    />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Филиал *</label>
                    <select
                        className="border rounded px-3 py-2 w-full"
                        value={form.branch_id}
                        onChange={(e)=>setForm(f=>({...f, branch_id: e.target.value }))}
                        required
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id="active"
                        type="checkbox"
                        checked={!!form.active}
                        onChange={(e)=>setForm(f=>({...f, active: e.target.checked }))}
                    />
                    <label htmlFor="active">Активна (доступна для записи)</label>
                </div>
            </div>

            <div className="flex gap-2">
                <button disabled={saving} className="border rounded px-4 py-2">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
