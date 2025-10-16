'use client';

import Link from 'next/link';
import React, {useEffect, useMemo, useState} from 'react';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
    created_at?: string | null;
};

type ListRes = { ok: true; items: Role[] } | { ok: false; error: string };
type MutRes = { ok: true; id?: string } | { ok: false; error: string };

export default function RolesClient({baseURL}: { baseURL?: string }) {
    const prefix = baseURL ?? '';
    const api = useMemo(() => {
        return {
            list: `${prefix}/admin/api/roles/list`,
            remove: (rid: string) => `${prefix}/admin/api/roles/${encodeURIComponent(rid)}/delete`,
        };
    }, [prefix]);

    const [items, setItems] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const res = await fetch(api.list, {cache: 'no-store'});
            const json = (await res.json()) as ListRes;
            if (!res.ok || !('ok' in json) || json.ok !== true) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            setItems(json.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function onDelete(r: Role) {
        if (r.is_system) {
            setErr('Это системная роль — удаление запрещено.');
            return;
        }
        if (!confirm(`Удалить роль «${r.name}»?`)) return;

        try {
            setErr(null);
            setDeletingId(r.id);
            const res = await fetch(api.remove(r.id), {method: 'POST'});
            const json = (await res.json()) as MutRes;
            if (!res.ok || !json.ok) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                    Управление ролями. Создание и редактирование — на отдельных страницах.
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2 w-[220px]">Ключ</th>
                        <th className="border-b p-2 w-[260px]">Название</th>
                        <th className="border-b p-2">Описание</th>
                        <th className="border-b p-2 w-[140px]">Системная</th>
                        <th className="border-b p-2 w-[240px]">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {loading && (
                        <tr>
                            <td className="p-3" colSpan={5}>Загрузка…</td>
                        </tr>
                    )}
                    {!loading && items.length === 0 && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={5}>Ролей пока нет.</td>
                        </tr>
                    )}
                    {!loading && items.map(r => (
                        <tr key={r.id}>
                            <td className="border-b p-2 font-mono">{r.key}</td>
                            <td className="border-b p-2">{r.name}</td>
                            <td className="border-b p-2">{r.description || '—'}</td>
                            <td className="border-b p-2">{r.is_system ? 'да' : 'нет'}</td>
                            <td className="border-b p-2">
                                <div className="flex gap-3">
                                    <Link className="underline" href={`/admin/roles/${r.id}`}>
                                        Редактировать
                                    </Link>
                                    <button
                                        className="underline text-red-600 disabled:opacity-50"
                                        onClick={() => onDelete(r)}
                                        type="button"
                                        disabled={!!r.is_system || deletingId === r.id}
                                        title={r.is_system ? 'Системную роль удалить нельзя' : 'Удалить'}
                                    >
                                        {deletingId === r.id ? 'Удаляю…' : 'Удалить'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}
        </div>
    );
}
