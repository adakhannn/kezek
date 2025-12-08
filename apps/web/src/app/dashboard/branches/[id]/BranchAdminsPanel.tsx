'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Администраторы филиала</h3>

            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full">
                    <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Пользователь</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Источник</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-40">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading && (
                        <tr>
                            <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={3}>Загрузка…</td>
                        </tr>
                    )}
                    {!loading && list.length === 0 && (
                        <tr>
                            <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={3}>Пока пусто</td>
                        </tr>
                    )}
                    {!loading && list.map((row) => (
                        <tr key={`${row.user_id}:${row.source}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="p-4">
                                <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">{row.user_id}</div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">{row.full_name ?? '—'}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{row.email ?? '—'}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{row.phone ?? '—'}</div>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    row.source === 'owner'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                        : row.source === 'biz_admin'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                }`}>
                                    {row.source === 'owner' ? 'владелец бизнеса'
                                        : row.source === 'biz_admin' ? 'админ бизнеса'
                                            : 'админ филиала'}
                                </span>
                            </td>
                            <td className="p-4">
                                {row.source === 'branch_admin' ? (
                                    <Button variant="outline" size="sm" onClick={() => remove(row.user_id)} type="button">
                                        Убрать
                                    </Button>
                                ) : (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">наследовано</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Поиск и добавление явных админов */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Добавить администратора из существующих пользователей</div>
                <div className="flex gap-3">
                    <Input
                        placeholder="email / телефон / имя"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        className="flex-1"
                    />
                    <Button onClick={doSearch} disabled={searching} isLoading={searching}>
                        {searching ? 'Ищем…' : 'Найти'}
                    </Button>
                </div>

                {found.length > 0 && (
                    <div className="max-h-56 overflow-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Имя</th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Email</th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Телефон</th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-32">Действия</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {found.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{u.full_name ?? '—'}</td>
                                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.email ?? '—'}</td>
                                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.phone ?? '—'}</td>
                                    <td className="p-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => add(u.id)}
                                            disabled={explicitIds.has(u.id)}
                                            type="button"
                                        >
                                            {explicitIds.has(u.id) ? 'Уже добавлен' : 'Добавить'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
