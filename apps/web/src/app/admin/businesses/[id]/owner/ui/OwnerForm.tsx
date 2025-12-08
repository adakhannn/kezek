'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';

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
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Владелец бизнеса</h3>
            <div className="flex flex-wrap items-center gap-3">
                <select
                    className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-w-[320px]"
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

                <Button
                    onClick={save}
                    disabled={loading || !changed}
                    isLoading={loading}
                >
                    {loading ? 'Сохраняю…' : 'Сохранить'}
                </Button>
                {!changed && <span className="text-xs text-gray-500 dark:text-gray-400">Нет изменений</span>}
            </div>

            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}
            {ok && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium">{ok}</p>
                </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                Выберите существующего пользователя системы. Заблокированные не могут быть владельцами.
            </div>
        </div>
    );
}
