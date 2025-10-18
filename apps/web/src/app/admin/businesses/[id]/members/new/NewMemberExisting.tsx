'use client';

import { useEffect, useMemo, useState } from 'react';

type UserMini = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type SearchResp = { ok: true; items: UserMini[] } | { ok: false; error: string };
type MutResp    = { ok: true } | { ok: false; error: string };

const ELEVATED = ['owner','admin','staff'] as const;
type ElevatedRole = typeof ELEVATED[number];

export default function NewMemberExisting({ baseURL, bizId }: { baseURL: string; bizId: string }) {
    const api = useMemo(() => {
        return {
            search: `${baseURL}/admin/api/users/search`,
            grant:  `${baseURL}/admin/api/businesses/${encodeURIComponent(bizId)}/members/grant`,
        };
    }, [baseURL, bizId]);

    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [list, setList] = useState<UserMini[]>([]);
    const [role, setRole] = useState<ElevatedRole>('staff');

    async function searchUsers() {
        setLoading(true); setErr(null);
        try {
            const url = new URL(api.search);
            if (q.trim()) url.searchParams.set('q', q.trim());
            const res = await fetch(url.toString(), { cache: 'no-store' });
            const j = (await res.json()) as SearchResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            setList(j.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void searchUsers(); /* при загрузке — первые 20 */ }, []);  

    async function grant(userId: string) {
        setErr(null);
        try {
            const res = await fetch(api.grant, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id: userId, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            alert('Роль выдана. Перейдите к списку участников, чтобы проверить.');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    className="border rounded px-3 py-2"
                    placeholder="Поиск по email/телефону/имени…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
                <button className="border rounded px-3 py-2" onClick={searchUsers} disabled={loading}>
                    {loading ? 'Ищу…' : 'Найти'}
                </button>

                <span className="mx-2 text-sm text-gray-500">Роль:</span>
                <select className="border rounded px-3 py-2" value={role}
                        onChange={e => setRole(e.target.value as ElevatedRole)}>
                    {ELEVATED.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2">Пользователь</th>
                        <th className="border-b p-2 w-48">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {list.map(u => (
                        <tr key={u.id}>
                            <td className="border-b p-2">
                                <div className="font-mono text-xs text-gray-500">{u.id}</div>
                                <div>{u.full_name || '—'}</div>
                                <div className="text-gray-600">{u.email || '—'}</div>
                                <div className="text-gray-600">{u.phone || '—'}</div>
                            </td>
                            <td className="border-b p-2">
                                <button className="border rounded px-3 py-1.5 hover:bg-gray-50" onClick={() => grant(u.id)}>
                                    Выдать роль {role}
                                </button>
                            </td>
                        </tr>
                    ))}
                    {list.length === 0 && (
                        <tr><td className="p-3 text-gray-500" colSpan={2}>Ничего не найдено.</td></tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
