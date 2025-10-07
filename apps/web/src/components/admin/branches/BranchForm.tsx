// apps/web/src/components/admin/branches/BranchForm.tsx
'use client';

import {useRouter} from 'next/navigation';
import React, {useMemo, useState} from 'react';

type Props = {
    mode: 'create' | 'edit';
    bizId: string;
    branchId?: string;
    initial?: { name: string; address: string; is_active: boolean };
};

type ApiOk = { ok: true; id?: string };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

type CreateBody = { name: string; address: string | null; is_active: boolean };
type UpdateBody = { name: string; address: string | null; is_active: boolean };

export function BranchForm({mode, bizId, branchId, initial}: Props) {
    const router = useRouter();
    const [name, setName] = useState<string>(initial?.name ?? '');
    const [address, setAddress] = useState<string>(initial?.address ?? '');
    const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const changed = useMemo(() => {
        if (mode === 'create') return true; // в create всегда можно отправлять
        return (
            name !== (initial?.name ?? '') ||
            address !== (initial?.address ?? '') ||
            isActive !== (initial?.is_active ?? true)
        );
    }, [mode, name, address, isActive, initial]);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            const trimmedName = name.trim();
            const trimmedAddress = address.trim();

            if (!trimmedName) {
                throw new Error('Название филиала обязательно');
            }
            if (mode === 'edit' && !branchId) {
                throw new Error('Не указан branchId для режима редактирования');
            }

            const url =
                mode === 'create'
                    ? `/admin/api/businesses/${bizId}/branches/create`
                    : `/admin/api/businesses/${bizId}/branches/${branchId}/update`;

            const body: CreateBody | UpdateBody = {
                name: trimmedName,
                address: trimmedAddress || null,
                is_active: isActive,
            };

            const resp = await fetch(url, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: ApiResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as ApiResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push(`/admin/businesses/${bizId}/branches`);
            router.refresh();
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-3 max-w-xl">
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Название филиала *"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
                name="branch_name"
            />
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder='Адрес (например, "Пушкина 4")'
                value={address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                name="branch_address"
                autoComplete="street-address"
            />
            <label className="inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
                />
                Активен
            </label>

            {err && <div className="text-red-600 text-sm">{err}</div>}
            <button
                className="border rounded px-3 py-2"
                disabled={loading || (mode === 'edit' && !changed)}
                type="submit"
                aria-busy={loading}
            >
                {loading ? 'Сохраняю…' : mode === 'create' ? 'Создать филиал' : 'Сохранить изменения'}
            </button>
            {mode === 'edit' && !changed && <span className="ml-2 text-xs text-gray-500">Нет изменений</span>}
        </form>
    );
}

