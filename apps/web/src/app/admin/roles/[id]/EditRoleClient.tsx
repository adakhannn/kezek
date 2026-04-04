'use client';

import React, {useState} from 'react';

import {AlertBanner} from '@/components/ui/AlertBanner';
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
            setErr('РќР°Р·РІР°РЅРёРµ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ.');
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
                        РЎРёСЃС‚РµРјРЅС‹Р№ РєР»СЋС‡
                    </label>
                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{role.key}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        РЎРёСЃС‚РµРјРЅС‹Р№ РєР»СЋС‡ РЅРµР»СЊР·СЏ РёР·РјРµРЅРёС‚СЊ
                    </p>
                </div>

                <Input
                    label="РќР°Р·РІР°РЅРёРµ *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />

                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        РћРїРёСЃР°РЅРёРµ
                    </label>
                    <textarea
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-h-[100px]"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="РљСЂР°С‚РєРѕ РѕРїРёС€РёС‚Рµ РЅР°Р·РЅР°С‡РµРЅРёРµ СЂРѕР»Рё"
                    />
                </div>

                {success ? <AlertBanner variant="success" message="РЎРѕС…СЂР°РЅРµРЅРѕ" compact /> : null}
                {err && !success ? <AlertBanner variant="danger" message={err} compact /> : null}

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={saving}
                        isLoading={saving}
                    >
                        {saving ? 'РЎРѕС…СЂР°РЅСЏСЋвЂ¦' : 'РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
