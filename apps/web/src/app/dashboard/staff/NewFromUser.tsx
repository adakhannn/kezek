'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Branch = { id: string; name: string };
type FoundUser = { id: string; email: string | null; phone: string | null; full_name: string };

export default function NewFromUser({ branches }: { branches: Branch[] }) {
    const r = useRouter();

    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<FoundUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? '');
    const [isActive, setIsActive] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    async function doSearch(query: string) {
        setLoading(true); setErr(null);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({ q: query }),
            });
            const j = await res.json();
            if (!j.ok) {
                setErr(j.error ?? 'search_failed');
                setResults([]);
            } else {
                setResults(j.items ?? []);
            }
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    // 👉 подгружаем первую страницу сразу при открытии (без запроса)
    useEffect(() => { doSearch(''); }, []); // пустая строка → сервер вернёт первую страницу

    async function createStaff() {
        if (!selectedUserId) return alert('Выберите пользователя');
        if (!branchId) return alert('Выберите филиал');

        const res = await fetch('/api/staff/create-from-user', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({ user_id: selectedUserId, branch_id: branchId, is_active: isActive }),
        });
        const j = await res.json();
        if (!j.ok) {
            return alert(j.error ?? 'Не удалось создать сотрудника');
        }
        r.push('/dashboard/staff');
    }

    return (
        <div className="space-y-6">
            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Поиск пользователя (email / телефон / ФИО)</label>
                <div className="flex gap-3">
                    <Input
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        placeholder="Например: +996, example@mail.com, Иван"
                        className="flex-1"
                    />
                    <Button onClick={() => doSearch(q)} disabled={loading} isLoading={loading}>
                        {loading ? 'Ищем…' : 'Найти'}
                    </Button>
                </div>

                <div className="max-h-64 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-10">#</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Имя</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Email</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Телефон</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-24">Выбрать</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {results.map((u, i) => (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-gray-600 dark:text-gray-400">{i+1}</td>
                                <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{u.full_name}</td>
                                <td className="p-3 text-gray-700 dark:text-gray-300">{u.email ?? '—'}</td>
                                <td className="p-3 text-gray-700 dark:text-gray-300">{u.phone ?? '—'}</td>
                                <td className="p-3">
                                    <input
                                        type="radio"
                                        name="pick"
                                        checked={selectedUserId === u.id}
                                        onChange={()=>setSelectedUserId(u.id)}
                                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </td>
                            </tr>
                        ))}
                        {results.length === 0 && (
                            <tr>
                                <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={5}>Ничего не найдено</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 grid sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Филиал</label>
                    <select
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        value={branchId}
                        onChange={e=>setBranchId(e.target.value)}
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={isActive}
                        onChange={e=>setIsActive(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Активен</label>
                </div>
                <div className="flex items-end">
                    <Button onClick={createStaff} className="w-full">
                        Добавить
                    </Button>
                </div>
            </div>
        </div>
    );
}
