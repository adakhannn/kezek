'use client';

import React, {useState} from 'react';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
};

type MutRes = { ok: true } | { ok: false; error: string };

export default function EditRoleClient({role}: { role: Role }) {
    const [name, setName] = useState(role.name);
    const [desc, setDesc] = useState(role.description ?? '');
    const [err, setErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setErr('Название обязательно.');
            return;
        }
        try {
            setSaving(true);
            setErr(null);
            const res = await fetch(`/admin/api/roles/${encodeURIComponent(role.id)}/update`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({name: name.trim(), description: desc.trim() || null}),
            });
            const json = (await res.json()) as MutRes;
            if (!res.ok || !json.ok) throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            setErr('Сохранено');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="border rounded p-4 space-y-3 max-w-2xl">
            <div className="grid gap-3">
                <div className="text-xs text-gray-500">Системный ключ</div>
                <div className="font-mono">{role.key}</div>
            </div>

            <label className="block">
                <div className="text-xs text-gray-500 mb-1">Название *</div>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
            </label>

            <label className="block">
                <div className="text-xs text-gray-500 mb-1">Описание</div>
                <textarea
                    className="border rounded px-3 py-2 w-full min-h-[80px]"
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                />
            </label>

            {err && <div className="text-sm text-red-600">{err}</div>}

            <div className="flex gap-2">
                <button type="submit" disabled={saving}
                        className="border rounded px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
                    {saving ? 'Сохраняю…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
