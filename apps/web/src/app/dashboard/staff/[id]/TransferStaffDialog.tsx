'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

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
            <Button variant="outline" size="sm" onClick={()=>setOpen(true)} type="button">
                Перевести сотрудника
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>!loading && setOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Перевод сотрудника</h3>
                            <button
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                onClick={()=>!loading && setOpen(false)}
                                type="button"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Текущий филиал</div>
                            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                {branches.find(b=>b.id===currentBranchId)?.name ?? '—'}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Новый филиал *</label>
                            <select
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                value={target}
                                onChange={e=>setTarget(e.target.value)}
                            >
                                <option value="">— выбрать —</option>
                                {otherBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={copySchedule}
                                onChange={e=>setCopySchedule(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Скопировать шаблон расписания из старого филиала</span>
                        </label>

                        {!!err && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="outline" disabled={loading} onClick={()=>setOpen(false)} type="button">
                                Отменить
                            </Button>
                            <Button disabled={loading} onClick={submit} isLoading={loading} type="button">
                                {loading ? 'Перевожу…' : 'Перевести'}
                            </Button>
                        </div>

                        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            Перевод выполняется сразу. Будущие брони не трогаем (перенос — отдельной задачей).
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
