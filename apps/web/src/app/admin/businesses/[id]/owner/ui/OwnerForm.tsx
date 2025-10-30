'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type UserRow = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    is_suspended: boolean | null;
    created_at?: string;
};

export function OwnerForm({
                              bizId,
                              users,
                              currentOwnerId,
                          }: {
    bizId: string;
    users: UserRow[];
    currentOwnerId: string | null;
}) {
    const router = useRouter();

    const options = useMemo(
        () =>
            users.map((u) => ({
                id: u.id,
                label: u.full_name || u.email || u.phone || u.id,
                suspended: !!u.is_suspended,
            })),
        [users]
    );

    const [selected, setSelected] = useState<string>(currentOwnerId ?? '');
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const changed = (selected || '') !== (currentOwnerId || '');

    async function save() {
        setErr(null);
        setOk(null);
        setLoading(true);
        try {
            // Клиентская защита: не даём назначать заблокированного
            const target = options.find((o) => o.id === selected);
            if (target?.suspended) {
                setErr('Этот пользователь заблокирован. Нельзя назначать владельцем.');
                return;
            }

            const resp = await fetch(`/admin/api/businesses/${bizId}/owner/save`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: selected || null }),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data = null;

            if (ct.includes('application/json')) {
                data = await resp.json();
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = { ok: true };
            }

            if (!resp.ok || !data?.ok) {
                throw new Error(data?.error || `HTTP ${resp.status}`);
            }

            setOk(selected ? 'Владелец назначен' : 'Владелец снят');
            router.refresh();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    className="border rounded px-3 py-2 min-w-[320px]"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                >
                    <option value="">— Снять владельца —</option>
                    {options.map((o) => (
                        <option key={o.id} value={o.id} disabled={o.suspended}>
                            {o.label}{o.suspended ? ' — заблокирован' : ''}
                        </option>
                    ))}
                </select>

                <button
                    className="border rounded px-3 py-2 disabled:opacity-50"
                    onClick={save}
                    disabled={loading || !changed}
                >
                    {loading ? 'Сохраняю…' : 'Сохранить'}
                </button>
                {!changed && <span className="text-xs text-gray-500">Нет изменений</span>}
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}
            {ok && <div className="text-green-600 text-sm">{ok}</div>}
            <div className="text-xs text-gray-500">
                Выберите существующего пользователя системы. Заблокированные не могут быть владельцами.
            </div>
        </div>
    );
}
