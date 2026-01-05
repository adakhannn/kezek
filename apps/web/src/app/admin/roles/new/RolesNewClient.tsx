'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Input} from '@/components/ui/Input';

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
        <Card className="p-6">
            <form onSubmit={submit} className="space-y-6">
                {err && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-300">{err}</p>
                    </div>
                )}

                <Input
                    label="Название *"
                    placeholder="Напр. Оператор филиала"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />

                <Input
                    label="Системный ключ (slug) *"
                    placeholder="Напр. branch_operator"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    helperText="Только латиница/цифры/нижнее подчёркивание/дефис: a-z 0-9 _ -"
                    required
                />

                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Описание
                    </label>
                    <textarea
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-h-[100px]"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Кратко опишите назначение роли"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={loading}
                        isLoading={loading}
                    >
                        {loading ? 'Создаём…' : 'Создать роль'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
