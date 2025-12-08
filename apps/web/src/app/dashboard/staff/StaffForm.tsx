'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        <form onSubmit={onSubmit} className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <Input
                label="ФИО"
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                required
            />

            <div className="grid sm:grid-cols-2 gap-4">
                <Input
                    label="E-mail"
                    type="email"
                    value={form.email ?? ''}
                    onChange={e => set('email', e.target.value || null)}
                    placeholder="optional"
                />
                <Input
                    label="Телефон"
                    value={form.phone ?? ''}
                    onChange={e => set('phone', e.target.value || null)}
                    placeholder="+996…"
                />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    id="is_active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Активен
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
