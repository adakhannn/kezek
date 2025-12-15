'use client';

import { useEffect, useMemo, useState } from 'react';

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
            {err && <div className="text-sm text-red-600">{err}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2 w-[340px]">Пользователь</th>
                        <th className="border-b p-2">Роли</th>
                        {canManage && <th className="border-b p-2 w-[260px]">Добавить роль</th>}
                        {canManage && <th className="border-b p-2 w-[200px]">Участник</th>}
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {loading && (
                        <tr>
                            <td className="p-3" colSpan={canManage ? 4 : 2}>
                                Загрузка…
                            </td>
                        </tr>
                    )}

                    {!loading && items.length === 0 && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={canManage ? 4 : 2}>
                                Пока никого.
                            </td>
                        </tr>
                    )}

                    {!loading &&
                        items.map((m) => {
                            const canAdd = (role: RoleKey) => !m.roles.includes(role);

                            return (
                                <tr key={m.user_id}>
                                    <td className="border-b p-2 align-top">
                                        <div className="font-mono text-xs text-gray-500 mb-1">{m.user_id}</div>
                                        <div>{m.full_name || '—'}</div>
                                        <div className="text-gray-600">{m.email || '—'}</div>
                                        <div className="text-gray-600">{m.phone || '—'}</div>
                                    </td>

                                    <td className="border-b p-2 align-top">
                                        <div className="flex flex-wrap gap-2">
                                            {m.roles.map((r) => (
                                                <span
                                                    key={r}
                                                    className="inline-flex items-center gap-2 border rounded-full px-3 py-1"
                                                    title={canManage ? 'Роль участника' : undefined}
                                                >
                            {r}
                                                    {canManage && (
                                                        <button
                                                            className="opacity-60 hover:opacity-100"
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
                                            {m.roles.length === 0 && <span className="text-gray-500">нет</span>}
                                        </div>
                                    </td>

                                    {canManage && (
                                        <td className="border-b p-2 align-top">
                                            <div className="flex flex-wrap gap-2">
                                                {(['owner', 'admin', 'manager', 'staff', 'client'] as RoleKey[])
                                                    .filter((r) => canAdd(r))
                                                    .map((r) => (
                                                        <button
                                                            key={r}
                                                            className="border rounded-full px-3 py-1 hover:bg-gray-50"
                                                            onClick={() => grant(m.user_id, r)}
                                                            type="button"
                                                        >
                                                            + {r}
                                                        </button>
                                                    ))}
                                            </div>
                                        </td>
                                    )}

                                    {canManage && (
                                        <td className="border-b p-2 align-top">
                                            <button
                                                className="border rounded px-3 py-1.5 hover:bg-gray-50"
                                                onClick={() => demote(m.user_id)}
                                                type="button"
                                            >
                                                Убрать из участников → client
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
