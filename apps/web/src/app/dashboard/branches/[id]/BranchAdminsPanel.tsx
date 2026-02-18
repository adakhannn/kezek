'use client';

import { useEffect, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

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

    // Пагинация для таблицы админов (на случай больших списков)
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

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

    // если список изменился — возвращаемся на первую страницу
    useEffect(() => {
        setPage(1);
    }, [list.length]);

    const explicitIds = useMemo(
        () => new Set(list.filter(x => x.source === 'branch_admin').map(x => x.user_id)),
        [list]
    );

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * perPage;
    const endIdx = Math.min(startIdx + perPage, total);
    const pageItems = useMemo(() => list.slice(startIdx, endIdx), [list, startIdx, endIdx]);

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
                    {!loading && pageItems.map((row) => (
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

            {!loading && total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Показано <span className="font-medium">{startIdx + 1}</span>–<span className="font-medium">{endIdx}</span> из <span className="font-medium">{total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">На странице</label>
                        <select
                            className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value) || 20)}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>

                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                        >
                            Назад
                        </Button>
                        <div className="text-sm text-gray-700 dark:text-gray-300 min-w-[90px] text-center">
                            {safePage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                        >
                            Вперёд
                        </Button>
                    </div>
                </div>
            )}

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
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                            <div className="grid grid-cols-4 gap-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                <div>Имя</div>
                                <div>Email</div>
                                <div>Телефон</div>
                                <div className="w-32">Действия</div>
                            </div>
                        </div>
                        {found.length > 50 ? (
                            // Виртуализация для длинных списков (>50 элементов)
                            <List
                                height={224} // max-h-56 = 224px
                                itemCount={found.length}
                                itemSize={56} // Примерная высота строки
                                width="100%"
                            >
                                {({ index, style }) => {
                                    const u = found[index];
                                    return (
                                        <div style={style} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div className="grid grid-cols-4 gap-3 px-3 py-3 text-sm">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{u.full_name ?? '—'}</div>
                                                <div className="text-gray-700 dark:text-gray-300">{u.email ?? '—'}</div>
                                                <div className="text-gray-700 dark:text-gray-300">{u.phone ?? '—'}</div>
                                                <div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => add(u.id)}
                                                        disabled={explicitIds.has(u.id)}
                                                        type="button"
                                                    >
                                                        {explicitIds.has(u.id) ? 'Уже добавлен' : 'Добавить'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </List>
                        ) : (
                            // Обычный рендер для коротких списков
                            <div className="max-h-56 overflow-auto">
                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {found.map(u => (
                                        <div key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div className="grid grid-cols-4 gap-3 px-3 py-3 text-sm">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{u.full_name ?? '—'}</div>
                                                <div className="text-gray-700 dark:text-gray-300">{u.email ?? '—'}</div>
                                                <div className="text-gray-700 dark:text-gray-300">{u.phone ?? '—'}</div>
                                                <div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => add(u.id)}
                                                        disabled={explicitIds.has(u.id)}
                                                        type="button"
                                                    >
                                                        {explicitIds.has(u.id) ? 'Уже добавлен' : 'Добавить'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
