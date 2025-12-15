'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Staff = {
    id?: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export default function StaffForm({
                                      initial,
                                      apiBase,
                                  }: {
    initial: Staff;
    apiBase: string; // '/api/staff'
}) {
    const r = useRouter();
    const [form, setForm] = useState<Staff>(initial);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function set<K extends keyof Staff>(k: K, v: Staff[K]) {
        setForm((f) => ({ ...f, [k]: v }));
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true); setErr(null);
        try {
            const url = form.id
                ? `${apiBase}/${encodeURIComponent(form.id)}/update`
                : `${apiBase}/create`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(form),
            });

            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }

            if (!res.ok || !payload.ok) {
                setErr(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            // успех
            r.push('/dashboard/staff');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }


    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div>
                <label className="block text-sm text-gray-600 mb-1">ФИО</label>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                    required
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={form.email ?? ''}
                        onChange={e => set('email', e.target.value || null)}
                        type="email"
                        placeholder="optional"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={form.phone ?? ''}
                        onChange={e => set('phone', e.target.value || null)}
                        placeholder="+996…"
                    />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">

                <div className="flex items-center gap-2 mt-6 sm:mt-0">
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={form.is_active}
                        onChange={e => set('is_active', e.target.checked)}
                    />
                    <label htmlFor="is_active">Активен</label>
                </div>
            </div>

            <div className="pt-2">
                <button disabled={saving} className="border rounded px-4 py-2">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
