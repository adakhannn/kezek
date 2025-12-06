// apps/web/src/components/admin/users/UserRolesEditor.tsx
'use client';

import { useMemo, useState } from 'react';

type RoleLiteral = 'owner' | 'manager' | 'staff' | 'admin' | 'client';
const ROLES = ['owner', 'manager', 'staff', 'admin', 'client'] as const;

type RoleRow = {
    biz_id: string;
    role: string;
    businesses?: { name: string | null; slug: string | null } | null;
};
type Biz = { id: string; name: string; slug: string };

type ApiOk = { ok: true };

function isRole(v: string): v is RoleLiteral {
    return (ROLES as readonly string[]).includes(v);
}
function isApiOk(v: unknown): v is ApiOk {
    return typeof v === 'object' && v !== null && 'ok' in v && (v as { ok?: unknown }).ok === true;
}
function getApiError(v: unknown): string | undefined {
    if (typeof v !== 'object' || v === null) return undefined;
    const raw = 'error' in v ? (v as { error?: unknown }).error : undefined;
    return typeof raw === 'string' && raw.trim().length ? raw.trim() : undefined;
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
    const [role, setRole] = useState<RoleLiteral>('client');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const currentBizId = useMemo(() => items[0]?.biz_id ?? null, [items]);
    const [biz, setBiz] = useState<string>(currentBizId ?? allBusinesses[0]?.id ?? '');

    async function add() {
        setLoading(true);
        setErr(null);
        try {
            const targetBiz = currentBizId ?? biz;
            if (!targetBiz) throw new Error('Выберите бизнес');

            if (currentBizId && currentBizId !== targetBiz) {
                throw new Error('У пользователя уже есть роли по другому бизнесу');
            }

            const exists = items.some((it) => it.biz_id === targetBiz && it.role === role);
            if (exists) {
                throw new Error('Такая роль уже есть у этого пользователя');
            }

            const resp = await fetch(`/admin/api/users/${userId}/roles/add`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ biz_id: targetBiz, role }),
            });

            let json: unknown = null;
            try {
                json = await resp.json();
            } catch (parseErr) {
                // Если ответ не JSON, json останется null, ошибка будет обработана ниже
                console.warn('[UserRolesEditor] Failed to parse JSON response:', parseErr);
            }

            if (!resp.ok || !isApiOk(json)) {
                throw new Error(getApiError(json) ?? `HTTP ${resp.status}`);
            }

            const bizObj = allBusinesses.find((x) => x.id === targetBiz);
            setItems((prev) => [
                ...prev,
                { biz_id: targetBiz, role, businesses: { name: bizObj?.name ?? null, slug: bizObj?.slug ?? null } },
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
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ biz_id, role: r }),
            });
            let json: unknown = null;
            try {
                json = await resp.json();
            } catch (parseErr) {
                // Если ответ не JSON, json останется null, ошибка будет обработана ниже
                console.warn('[UserRolesEditor] Failed to parse JSON response:', parseErr);
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
                    value={currentBizId ?? biz}
                    onChange={(e) => setBiz(e.target.value)}
                    disabled={!!currentBizId}
                >
                    {(currentBizId ? allBusinesses.filter((b) => b.id === currentBizId) : allBusinesses).map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name} ({b.slug})
                        </option>
                    ))}
                </select>

                <select
                    className="border rounded px-3 py-2"
                    value={role}
                    onChange={(e) => {
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

                <button className="border rounded px-3 py-2" disabled={loading} type="button" onClick={add}>
                    Добавить роль
                </button>
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
    );
}
