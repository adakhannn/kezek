'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        <form onSubmit={onSubmit} className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <Input
                label="Название"
                value={form.name}
                onChange={(e)=>setForm(f=>({...f, name: e.target.value }))}
                required
            />

            <Input
                label="Адрес"
                value={form.address ?? ''}
                onChange={(e)=>setForm(f=>({...f, address: e.target.value || null }))}
                placeholder="г. Бишкек, ул. ... 12"
            />

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    id="is_active"
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e)=>setForm(f=>({...f, is_active: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Активен (отображается клиентам)
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
