'use client';

import React, {useMemo, useState} from 'react';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

export function UserBasicForm({
                                  userId,
                                  initial,
                              }: {
    userId: string;
    initial: { full_name: string; email: string; phone: string };
}) {
    const [fullName, setFullName] = useState<string>(initial.full_name ?? '');
    const [email, setEmail] = useState<string>(initial.email ?? '');
    const [phone, setPhone] = useState<string>(initial.phone ?? '');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const changed = useMemo(
        () =>
            (fullName ?? '') !== (initial.full_name ?? '') ||
            (email ?? '') !== (initial.email ?? '') ||
            (phone ?? '') !== (initial.phone ?? ''),
        [fullName, email, phone, initial]
    );

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    function validateEmail(v: string): boolean {
        if (!v.trim()) return true; // email опционален
        // простая проверка
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    }

    function validatePhoneE164(v: string): boolean {
        if (!v.trim()) return true; // телефон можно пустить — бэкенд решит
        // E.164: + и 8-15 цифр (без пробелов)
        return /^\+[1-9]\d{7,14}$/.test(v.trim());
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);
        setErr(null);
        try {
            if (!validateEmail(email)) {
                throw new Error('Некорректный email');
            }
            if (!validatePhoneE164(phone)) {
                throw new Error('Телефон должен быть в формате E.164, например: +996XXXYYYYYY');
            }

            const body = JSON.stringify({
                full_name: fullName.trim(),
                email: email.trim() || null,
                phone: phone.trim() || null,
            });

            const resp = await fetch(`/admin/api/users/${userId}/update-basic`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body,
                credentials: 'include',
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: ApiResp | null = null;
            if (ct.includes('application/json')) {
                data = (await resp.json()) as ApiResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 1500));
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                throw new Error(('error' in (data ?? {}) && (data as ApiErr).error) || `HTTP ${resp.status}`);
            }

            setMsg('Сохранено');
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-3 rounded border p-4">
            <h3 className="font-semibold">Основные данные</h3>

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Имя"
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                name="full_name"
                autoComplete="name"
            />

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                type="email"
                name="email"
                autoComplete="email"
            />

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Телефон (+996…)"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                type="tel"
                name="phone"
                inputMode="tel"
                // Мягкая подсказка для E.164
                pattern="^\+[1-9]\d{7,14}$"
                title="Формат E.164: +996XXXXXXXXX"
            />

            <div className="flex items-center gap-2">
                <button className="border rounded px-3 py-2" disabled={loading || !changed} type="submit"
                        aria-busy={loading}>
                    {loading ? 'Сохраняю…' : 'Сохранить'}
                </button>
                {msg && <span className="text-green-600 text-sm">{msg}</span>}
                {err && <span className="text-red-600 text-sm">{err}</span>}
                {!changed && <span className="text-xs text-gray-500">Нет изменений</span>}
            </div>
        </form>
    );
}

