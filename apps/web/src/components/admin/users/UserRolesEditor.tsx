'use client';

import {useState} from 'react';

type RoleLiteral = 'owner' | 'manager' | 'staff' | 'admin' | 'client';
const ROLES = ['owner', 'manager', 'staff', 'admin', 'client'] as const;

type RoleRow = {
    biz_id: string;
    role: string; // приходит с сервера как string; добавляем роль локально из RoleLiteral
    businesses?: { name: string | null; slug: string | null } | null;
};
type Biz = { id: string; name: string; slug: string };

// API response helpers
type ApiOk = { ok: true };

function isRole(v: string): v is RoleLiteral {
    return (ROLES as readonly string[]).includes(v);
}

function isApiOk(v: unknown): v is ApiOk {
    if (typeof v !== 'object' || v === null) return false;
    const rec = v as Record<string, unknown>;
    return rec['ok'] === true;
}

function getApiError(v: unknown): string | undefined {
    if (typeof v !== 'object' || v === null) return undefined;
    const rec = v as Record<string, unknown>;
    return typeof rec['error'] === 'string' ? (rec['error'] as string) : undefined;
}

export function UserRolesEditor({
                                    userId,
                                    roles,
                                    allBusinesses,
                                }: {
    userId: string;
    roles: RoleRow[];
    allBusinesses: Biz[];
}) {
    const [items, setItems] = useState<RoleRow[]>(roles ?? []);
    const [biz, setBiz] = useState<string>(allBusinesses[0]?.id ?? '');
    const [role, setRole] = useState<RoleLiteral>('client');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function add() {
        setLoading(true);
        setErr(null);
        try {
            if (!biz) throw new Error('Выберите бизнес');
            // защита от дублей
            const exists = items.some((it) => it.biz_id === biz && it.role === role);
            if (exists) {
                throw new Error('Такая роль уже есть у этого пользователя');
            }

            const resp = await fetch(`/admin/api/users/${userId}/roles/add`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({biz_id: biz, role}),
            });
            let json: unknown = null;
            try {
                json = await resp.json();
            } catch {
                /* ignore */
            }
            if (!resp.ok || !isApiOk(json)) {
                throw new Error(getApiError(json) ?? `HTTP ${resp.status}`);
            }

            const bizObj = allBusinesses.find((x) => x.id === biz);
            setItems((prev) => [
                ...prev,
                {
                    biz_id: biz,
                    role, // RoleLiteral совместим со string в RoleRow
                    businesses: {name: bizObj?.name ?? null, slug: bizObj?.slug ?? null},
                },
            ]);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function remove(biz_id: string, r: string) {
        setLoading(true);
        setErr(null);
        try {
            const resp = await fetch(`/admin/api/users/${userId}/roles/remove`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({biz_id, role: r}),
            });
            let json: unknown = null;
            try {
                json = await resp.json();
            } catch {
                /* ignore */
            }
            if (!resp.ok || !isApiOk(json)) {
                throw new Error(getApiError(json) ?? `HTTP ${resp.status}`);
            }
            setItems((prev) => prev.filter((x) => !(x.biz_id === biz_id && x.role === r)));
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-3 rounded border p-4">
            <h3 className="font-semibold">Роли по бизнесам</h3>

            <div className="flex flex-wrap gap-2">
                {items.map((r, idx) => (
                    <span
                        key={`${r.biz_id}:${r.role}:${idx}`}
                        className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm"
                    >
            <span>{r.businesses?.name ?? r.biz_id}</span>
            <span className="text-gray-500">/ {r.role}</span>
            <button
                type="button"
                className="opacity-60 hover:opacity-100"
                onClick={() => remove(r.biz_id, r.role)}
                aria-label="Удалить роль"
                title="Удалить роль"
            >
              ×
            </button>
          </span>
                ))}
                {items.length === 0 && <div className="text-sm text-gray-500">Ролей нет.</div>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <select
                    className="border rounded px-3 py-2"
                    value={biz}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBiz(e.target.value)}
                >
                    {allBusinesses.map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name} ({b.slug})
                        </option>
                    ))}
                </select>

                <select
                    className="border rounded px-3 py-2"
                    value={role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const v = e.target.value;
                        if (isRole(v)) setRole(v);
                    }}
                >
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>

                <button className="border rounded px-3 py-2" disabled={loading || !biz} type="button" onClick={add}>
                    Добавить роль
                </button>
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
    );
}
