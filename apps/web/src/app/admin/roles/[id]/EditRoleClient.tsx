'use client';

import React, {useState} from 'react';

import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Input} from '@/components/ui/Input';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
};

type MutRes = { ok: true } | { ok: false; error: string };

export default function EditRoleClient({role}: { role: Role }) {
    const [name, setName] = useState(role.name);
    const [desc, setDesc] = useState(role.description ?? '');
    const [err, setErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setErr('Название обязательно.');
            return;
        }
        try {
            setSaving(true);
            setErr(null);
            const res = await fetch(`/admin/api/roles/${encodeURIComponent(role.id)}/update`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({name: name.trim(), description: desc.trim() || null}),
            });
            const json = (await res.json()) as MutRes;
            if (!res.ok || !json.ok) throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            setSuccess(true);
            setErr(null);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Системный ключ
                    </label>
                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{role.key}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Системный ключ нельзя изменить
                    </p>
                </div>

                <Input
                    label="Название *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />

                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Описание
                    </label>
                    <textarea
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-h-[100px]"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="Кратко опишите назначение роли"
                    />
                </div>

                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Сохранено
                        </div>
                    </div>
                )}

                {err && !success && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-300">{err}</p>
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={saving}
                        isLoading={saving}
                    >
                        {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
