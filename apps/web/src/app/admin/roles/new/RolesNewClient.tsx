'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

type Props = { baseURL: string };

export default function RolesNewClient({baseURL}: Props) {
    const r = useRouter();
    const [name, setName] = useState('');
    const [key, setKey] = useState(''); // системный ключ (slug)
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        const nameTrim = name.trim();
        const keyTrim = key.trim().toLowerCase();

        if (!nameTrim) return setErr('Название обязательно');
        // такой же паттерн, как в остальных местах
        if (!/^[a-z0-9_-]{2,32}$/.test(keyTrim)) {
            return setErr('Ключ роли: только [a-z0-9_-], длина 2–32 символа');
        }

        setLoading(true);
        try {
            const res = await fetch(`${baseURL}/admin/api/roles/create`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({
                    key: keyTrim,                 // ВАЖНО: ключ зовём key, а не code
                    name: nameTrim,
                    description: description.trim() || null,
                }),
            });
            const json = (await res.json()) as { ok: boolean; error?: string; id?: string };
            if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
            r.push('/admin/roles');
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="max-w-xl space-y-4">
            {err && <div className="text-red-600 text-sm">{err}</div>}

            <label className="block">
                <div className="text-sm text-gray-600 mb-1">Название *</div>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Напр. Оператор филиала"
                />
            </label>

            <label className="block">
                <div className="text-sm text-gray-600 mb-1">Системный ключ (slug) *</div>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Напр. branch_operator"
                />
                <div className="text-xs text-gray-500 mt-1">
                    Только латиница/цифры/нижнее подчёркивание/дефис: a-z 0-9 _ -
                </div>
            </label>

            <label className="block">
                <div className="text-sm text-gray-600 mb-1">Описание</div>
                <textarea
                    className="border rounded px-3 py-2 w-full min-h-[90px]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Кратко опишите назначение роли"
                />
            </label>

            <div className="flex gap-2">
                <button
                    disabled={loading}
                    className="border rounded px-4 py-2 disabled:opacity-50"
                    type="submit"
                >
                    {loading ? 'Создаём…' : 'Создать'}
                </button>
            </div>
        </form>
    );
}
