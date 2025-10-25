'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Initial = {
    id?: string;
    name: string;
    address: string | null;
    is_active: boolean;
};

export default function BranchForm({
                                       initial,
                                       apiBase,
                                   }: {
    initial: Initial;
    apiBase: string; // '/api/branches'
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
            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }

            if (!res.ok || !payload.ok) {
                setErr(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            r.push('/dashboard/branches');
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
                    value={form.name}
                    onChange={(e)=>setForm(f=>({...f, name: e.target.value }))}
                    required
                />
            </div>

            <div>
                <label className="block text-sm text-gray-600 mb-1">Адрес</label>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={form.address ?? ''}
                    onChange={(e)=>setForm(f=>({...f, address: e.target.value || null }))}
                    placeholder="г. Бишкек, ул. ... 12"
                />
            </div>

            <div className="flex items-center gap-2">
                <input
                    id="is_active"
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e)=>setForm(f=>({...f, is_active: e.target.checked }))}
                />
                <label htmlFor="is_active">Активен (отображается клиентам)</label>
            </div>

            <div className="flex gap-2">
                <button disabled={saving} className="border rounded px-4 py-2">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
