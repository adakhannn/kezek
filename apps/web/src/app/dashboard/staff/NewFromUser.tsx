'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
        <div className="space-y-4">
            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div className="border rounded p-3 space-y-2">
                <label className="block text-sm text-gray-600">Поиск пользователя (email / телефон / ФИО)</label>
                <div className="flex gap-2">
                    <input className="border rounded px-3 py-2 w-full" value={q} onChange={e=>setQ(e.target.value)} placeholder="Например: +996, example@mail.com, Иван"/>
                    <button onClick={() => doSearch(q)} className="border rounded px-3 py-2" disabled={loading}>{loading ? 'Ищем…' : 'Найти'}</button>
                </div>

                <div className="max-h-64 overflow-auto mt-2 border rounded">
                    <table className="min-w-full text-sm">
                        <thead><tr className="text-left">
                            <th className="p-2 w-10">#</th>
                            <th className="p-2">Имя</th>
                            <th className="p-2">Email</th>
                            <th className="p-2">Телефон</th>
                            <th className="p-2 w-24">Выбрать</th>
                        </tr></thead>
                        <tbody>
                        {results.map((u, i) => (
                            <tr key={u.id} className="border-t">
                                <td className="p-2">{i+1}</td>
                                <td className="p-2">{u.full_name}</td>
                                <td className="p-2">{u.email ?? '—'}</td>
                                <td className="p-2">{u.phone ?? '—'}</td>
                                <td className="p-2">
                                    <input
                                        type="radio"
                                        name="pick"
                                        checked={selectedUserId === u.id}
                                        onChange={()=>setSelectedUserId(u.id)}
                                    />
                                </td>
                            </tr>
                        ))}
                        {results.length === 0 && <tr><td className="p-2 text-gray-500" colSpan={5}>Ничего не найдено</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="border rounded p-3 grid sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Филиал</label>
                    <select className="border rounded px-3 py-2 w-full" value={branchId} onChange={e=>setBranchId(e.target.value)}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 mt-6 sm:mt-0">
                    <input id="is_active" type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
                    <label htmlFor="is_active">Активен</label>
                </div>
                <div className="flex items-end">
                    <button onClick={createStaff} className="border rounded px-4 py-2 w-full">Добавить</button>
                </div>
            </div>
        </div>
    );
}
