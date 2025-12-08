'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';

type MemberRow = {
    user_id: string;
    email: string | null;
    phone: string | null;
    roles: string[]; // role_key[]
    full_name: string | null;
};

type ListResp = { ok: true; items: MemberRow[] } | { ok: false; error: string };
type MutResp  = { ok: true } | { ok: false; error: string };

export type RoleKey = 'owner' | 'admin' | 'manager' | 'staff' | 'client';

export default function MembersClient({
                                          baseURL,
                                          bizId,
                                          canManage,
                                      }: {
    baseURL: string;
    bizId: string;
    canManage: boolean; // <-- новый флаг
}) {
    const api = useMemo(() => {
        const root = `${baseURL}/admin/api/businesses/${encodeURIComponent(bizId)}/members`;
        return {
            list:   `${root}/list`,
            grant:  `${root}/grant`,
            revoke: `${root}/revoke`,
            demote: `${root}/demote`,
        };
    }, [baseURL, bizId]);

    const [items, setItems]   = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr]         = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const res = await fetch(api.list, { cache: 'no-store' });
            const j = (await res.json()) as ListResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            setItems(j.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, [api.list]);

    async function grant(user_id: string, role: RoleKey) {
        if (!canManage) return;
        setErr(null);
        try {
            const res = await fetch(api.grant, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    async function revoke(user_id: string, role: RoleKey) {
        if (!canManage) return;
        setErr(null);
        try {
            const res = await fetch(api.revoke, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    async function demote(user_id: string) {
        if (!canManage) return;
        if (!confirm('Убрать участника до «client»? Все другие роли будут сняты.')) return;
        setErr(null);
        try {
            const res = await fetch(api.demote, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[960px] w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-[340px]">Пользователь</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Роли</th>
                            {canManage && <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-[260px]">Добавить роль</th>}
                            {canManage && <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-[200px]">Участник</th>}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={canManage ? 4 : 2}>
                                    Загрузка…
                                </td>
                            </tr>
                        )}

                        {!loading && items.length === 0 && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={canManage ? 4 : 2}>
                                    Пока никого.
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            items.map((m) => {
                                const canAdd = (role: RoleKey) => !m.roles.includes(role);

                                return (
                                    <tr key={m.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="p-4 align-top">
                                            <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">{m.user_id}</div>
                                            <div className="font-medium text-gray-900 dark:text-gray-100">{m.full_name || '—'}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{m.email || '—'}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{m.phone || '—'}</div>
                                        </td>

                                        <td className="p-4 align-top">
                                            <div className="flex flex-wrap gap-2">
                                                {m.roles.map((r) => (
                                                    <span
                                                        key={r}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                                                        title={canManage ? 'Роль участника' : undefined}
                                                    >
                                                        {r}
                                                        {canManage && (
                                                            <button
                                                                className="opacity-60 hover:opacity-100 transition-opacity"
                                                                onClick={() => revoke(m.user_id, r as RoleKey)}
                                                                type="button"
                                                                title="Убрать роль"
                                                                aria-label="Убрать роль"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                                {m.roles.length === 0 && <span className="text-gray-500 dark:text-gray-400">нет</span>}
                                            </div>
                                        </td>

                                        {canManage && (
                                            <td className="p-4 align-top">
                                                <div className="flex flex-wrap gap-2">
                                                    {(['owner', 'admin', 'manager', 'staff', 'client'] as RoleKey[])
                                                        .filter((r) => canAdd(r))
                                                        .map((r) => (
                                                            <Button
                                                                key={r}
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => grant(m.user_id, r)}
                                                                type="button"
                                                            >
                                                                + {r}
                                                            </Button>
                                                        ))}
                                                </div>
                                            </td>
                                        )}

                                        {canManage && (
                                            <td className="p-4 align-top">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => demote(m.user_id)}
                                                    type="button"
                                                >
                                                    Убрать из участников → client
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
