'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import BranchMapPickerYandex from './BranchMapPickerYandex';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';


type Props = {
    mode: 'create' | 'edit';
    bizId: string;
    branchId?: string;
    initial?: { name: string; address: string; is_active: boolean; lat?: number | null; lon?: number | null };
};

type ApiOk = { ok: true; id?: string };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

export function BranchForm({ mode, bizId, branchId, initial }: Props) {
    const router = useRouter();

    const [name, setName] = useState<string>(initial?.name ?? '');
    const [address, setAddress] = useState<string>(initial?.address ?? '');
    const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
    const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
    const [lon, setLon] = useState<number | null>(initial?.lon ?? null);

    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const changed = useMemo(() => {
        if (mode === 'create') return true;
        return (
            name !== (initial?.name ?? '') ||
            address !== (initial?.address ?? '') ||
            isActive !== (initial?.is_active ?? true) ||
            lat !== (initial?.lat ?? null) ||
            lon !== (initial?.lon ?? null)
        );
    }, [mode, name, address, isActive, lat, lon, initial]);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            const trimmedName = name.trim();
            if (!trimmedName) throw new Error('Название филиала обязательно');

            const url =
                mode === 'create'
                    ? `/admin/api/businesses/${bizId}/branches/create`
                    : `/admin/api/businesses/${bizId}/branches/${branchId}/update`;

            const body = {
                name: trimmedName,
                address: address.trim() || null,
                is_active: isActive,
                lat, lon, // если в БД ещё нет — просто игнорируй на бэке
            };

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: ApiResp | null = null;
            if (ct.includes('application/json')) data = (await resp.json()) as ApiResp;
            else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = { ok: true };
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push(`/admin/businesses/${bizId}/branches`);
            router.refresh();
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-6 max-w-2xl">
            <Input
                label="Название филиала"
                placeholder="Введите название филиала"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                name="branch_name"
                error={err && !name.trim() ? 'Название филиала обязательно' : undefined}
            />

            {/* Карта Яндекса */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Расположение на карте
                </label>
                <Card className="p-4">
                    <BranchMapPickerYandex
                        lat={lat ?? undefined}
                        lon={lon ?? undefined}
                        onPick={(la, lo, addr) => {
                            setLat(la);
                            setLon(lo);
                            if (addr) setAddress(addr); // адрес заполняется только через карту
                        }}
                    />
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Координаты: {lat ? lat.toFixed(6) : '—'}, {lon ? lon.toFixed(6) : '—'}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Кликните на карте, чтобы установить метку. Адрес заполнится автоматически.
                    </p>
                </Card>
            </div>

            <Input
                label="Адрес"
                placeholder="Адрес будет заполнен автоматически при выборе на карте"
                value={address}
                readOnly
                name="branch_address"
                autoComplete="street-address"
                helperText="Адрес заполняется автоматически при выборе точки на карте"
            />

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Филиал активен
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {isActive ? 'Филиал будет отображаться в публичном каталоге' : 'Филиал скрыт от пользователей'}
                </p>
            </div>

            {err && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-300">{err}</p>
                </div>
            )}

            <div className="flex items-center gap-3 pt-4">
                <Button
                    type="submit"
                    disabled={loading || (mode === 'edit' && !changed)}
                    isLoading={loading}
                    className="min-w-[160px]"
                >
                    {mode === 'create' ? 'Создать филиал' : 'Сохранить изменения'}
                </Button>
                {mode === 'edit' && !changed && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Нет изменений для сохранения</span>
                )}
            </div>
        </form>
    );
}
