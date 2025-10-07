// apps/web/src/components/admin/owner/OwnerForm.tsx
'use client';

import {useRouter} from 'next/navigation';
import React, {useMemo, useState} from 'react';

type Props = {
    bizId: string;
    initial: { fullName: string; email: string; phone: string };
};

type OwnerSaveAction =
    | 'updated_current'
    | 'reassigned_existing'
    | 'reassigned_new'
    | 'assigned_existing'
    | 'created_and_assigned';

type ApiOk = { ok: true; action?: OwnerSaveAction };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

export function OwnerForm({bizId, initial}: Props) {
    const router = useRouter();

    const [fullName, setFullName] = useState<string>(initial.fullName ?? '');
    const [email, setEmail] = useState<string>(initial.email ?? '');
    const [phone, setPhone] = useState<string>(initial.phone ?? '');
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const changed = useMemo(
        () =>
            fullName !== (initial.fullName ?? '') ||
            email !== (initial.email ?? '') ||
            phone !== (initial.phone ?? ''),
        [fullName, email, phone, initial]
    );

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    function actionToMessage(a?: OwnerSaveAction): string {
        switch (a) {
            case 'updated_current':
                return 'Данные владельца обновлены';
            case 'reassigned_existing':
                return 'Владелец переназначен на существующего пользователя';
            case 'reassigned_new':
                return 'Создан новый пользователь и назначен владельцем';
            case 'assigned_existing':
                return 'Назначен существующий пользователь владельцем';
            case 'created_and_assigned':
                return 'Создан и назначен владелец';
            default:
                return 'Сохранено';
        }
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErr(null);
        setOk(null);

        const full_name = fullName.trim() || null;
        const emailNorm = email.trim() || null;
        const phoneNorm = phone.trim() || null;

        if (!emailNorm && !phoneNorm) {
            setErr('Укажите хотя бы email или телефон владельца');
            return;
        }

        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/businesses/${bizId}/owner/save`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({full_name, email: emailNorm, phone: phoneNorm}),
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

            setOk(actionToMessage((data as ApiOk).action));
            router.refresh();
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-2 max-w-md">
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Имя владельца"
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                name="owner_full_name"
                autoComplete="name"
            />
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="E-mail владельца"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                type="email"
                name="owner_email"
                autoComplete="email"
            />
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Телефон владельца (+996…)"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                inputMode="tel"
                name="owner_phone"
                autoComplete="tel"
            />

            <div className="text-xs text-gray-500">
                Достаточно указать email или телефон. Если владельца ещё нет — он будет найден/создан и назначен.
                Если введены контакты другого пользователя — владелец будет переназначен.
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}
            {ok && <div className="text-green-600 text-sm">{ok}</div>}

            <button
                className="border rounded px-3 py-2"
                disabled={loading || !changed}
                type="submit"
                aria-busy={loading}
            >
                {loading ? 'Сохраняю…' : 'Сохранить'}
            </button>
            {!changed && <span className="ml-2 text-xs text-gray-500">Нет изменений</span>}
        </form>
    );
}
