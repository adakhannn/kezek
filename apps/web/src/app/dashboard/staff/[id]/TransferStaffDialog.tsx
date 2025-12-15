'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Branch = { id: string; name: string };

export default function TransferStaffDialog({
                                                staffId,
                                                currentBranchId,
                                                branches,
                                            }: {
    staffId: string;
    currentBranchId: string;
    branches: Branch[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<string>('');
    const [copySchedule, setCopySchedule] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const otherBranches = branches.filter(b => b.id !== currentBranchId);

    async function submit() {
        setLoading(true); setErr(null);
        try {
            if (!target) { setErr('Выберите филиал'); setLoading(false); return; }

            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/transfer`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ target_branch_id: target, copy_schedule: copySchedule }),
            });
            const j = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !j.ok) {
                setErr(j.error ?? `HTTP_${res.status}`); setLoading(false); return;
            }
            setOpen(false);
            // Обновляем серверные компоненты страницы
            router.refresh(); // или: window.location.reload();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
            setLoading(false);
        }
    }

    return (
        <div>
            <button className="border rounded px-3 py-1.5" onClick={()=>setOpen(true)} type="button">
                Перевести сотрудника
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={()=>!loading && setOpen(false)} />
                    <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded shadow p-4 space-y-3">
                        <h3 className="font-semibold text-lg">Перевод сотрудника</h3>

                        <div className="text-sm">
                            Текущий филиал: <b>{branches.find(b=>b.id===currentBranchId)?.name ?? '—'}</b>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm text-gray-600">Новый филиал *</label>
                            <select
                                className="border rounded px-3 py-2 w-full"
                                value={target}
                                onChange={e=>setTarget(e.target.value)}
                            >
                                <option value="">— выбрать —</option>
                                {otherBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={copySchedule}
                                onChange={e=>setCopySchedule(e.target.checked)}
                            />
                            Скопировать шаблон расписания из старого филиала
                        </label>

                        {!!err && <div className="text-sm text-red-600">{err}</div>}

                        <div className="flex gap-2 justify-end">
                            <button className="border rounded px-3 py-1.5" disabled={loading} onClick={()=>setOpen(false)} type="button">
                                Отменить
                            </button>
                            <button className="border rounded px-3 py-1.5" disabled={loading} onClick={submit} type="button">
                                {loading ? 'Перевожу…' : 'Перевести'}
                            </button>
                        </div>

                        <div className="text-xs text-gray-500">
                            Перевод выполняется сразу. Будущие брони не трогаем (перенос — отдельной задачей).
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
