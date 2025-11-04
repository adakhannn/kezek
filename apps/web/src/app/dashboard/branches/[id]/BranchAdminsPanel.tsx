'use client';

import { useEffect, useMemo, useState } from 'react';

type AdminRow = {
    user_id: string;
    source: 'owner' | 'biz_admin' | 'branch_admin';
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type SearchUser = { id: string; email: string | null; phone: string | null; full_name: string | null };

export default function BranchAdminsPanel({ branchId }: { branchId: string }) {
    const [list, setList] = useState<AdminRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [q, setQ] = useState('');
    const [found, setFound] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);

    async function load() {
        setLoading(true); setErr(null);
        try {
            const res = await fetch(`/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/list`, { method: 'POST' });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setList(j.items as AdminRow[]);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function doSearch() {
        setSearching(true); setErr(null);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ q }),
            });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setFound(j.items ?? []);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSearching(false);
        }
    }

    async function add(user_id: string) {
        setErr(null);
        try {
            const res = await fetch(`/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/add`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id }),
            });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            await load();
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    async function remove(user_id: string) {
        if (!confirm('Убрать пользователя из админов этого филиала?')) return;
        setErr(null);
        try {
            const res = await fetch(`/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/remove`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id }),
            });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            await load();
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    useEffect(() => { void load(); }, []);

    const explicitIds = useMemo(
        () => new Set(list.filter(x => x.source === 'branch_admin').map(x => x.user_id)),
        [list]
    );

    return (
        <section className="rounded border p-4 space-y-4">
            <h3 className="font-semibold">Администраторы филиала</h3>

            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-[720px] text-sm">
                    <thead>
                    <tr className="text-left">
                        <th className="p-2">Пользователь</th>
                        <th className="p-2">Источник</th>
                        <th className="p-2 w-40">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading && <tr><td className="p-2" colSpan={3}>Загрузка…</td></tr>}
                    {!loading && list.length === 0 && <tr><td className="p-2 text-gray-500" colSpan={3}>Пока пусто</td></tr>}
                    {!loading && list.map((row) => (
                        <tr key={`${row.user_id}:${row.source}`} className="border-t">
                            <td className="p-2">
                                <div className="font-mono text-xs text-gray-500">{row.user_id}</div>
                                <div>{row.full_name ?? '—'}</div>
                                <div className="text-gray-600">{row.email ?? '—'}</div>
                                <div className="text-gray-600">{row.phone ?? '—'}</div>
                            </td>
                            <td className="p-2">
                                {row.source === 'owner' ? 'владелец бизнеса'
                                    : row.source === 'biz_admin' ? 'админ бизнеса'
                                        : 'админ филиала'}
                            </td>
                            <td className="p-2">
                                {row.source === 'branch_admin' ? (
                                    <button className="border rounded px-3 py-1 hover:bg-gray-50" onClick={() => remove(row.user_id)} type="button">
                                        Убрать
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-500">наследовано</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Поиск и добавление явных админов */}
            <div className="border rounded p-3 space-y-2">
                <div className="text-sm text-gray-600">Добавить администратора из существующих пользователей</div>
                <div className="flex gap-2">
                    <input className="border rounded px-3 py-2 w-full" placeholder="email / телефон / имя" value={q} onChange={e=>setQ(e.target.value)} />
                    <button className="border rounded px-3 py-2" onClick={doSearch} disabled={searching}>
                        {searching ? 'Ищем…' : 'Найти'}
                    </button>
                </div>

                {found.length > 0 && (
                    <div className="max-h-56 overflow-auto border rounded">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left">
                                <th className="p-2">Имя</th>
                                <th className="p-2">Email</th>
                                <th className="p-2">Телефон</th>
                                <th className="p-2 w-32">Действия</th>
                            </tr>
                            </thead>
                            <tbody>
                            {found.map(u => (
                                <tr key={u.id} className="border-t">
                                    <td className="p-2">{u.full_name ?? '—'}</td>
                                    <td className="p-2">{u.email ?? '—'}</td>
                                    <td className="p-2">{u.phone ?? '—'}</td>
                                    <td className="p-2">
                                        <button
                                            className="border rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
                                            onClick={() => add(u.id)}
                                            disabled={explicitIds.has(u.id)}
                                            type="button"
                                        >
                                            {explicitIds.has(u.id) ? 'Уже добавлен' : 'Добавить'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {found.length === 0 && <tr><td className="p-2 text-gray-500" colSpan={4}>Ничего не найдено</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
