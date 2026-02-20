'use client';

import React, {useMemo, useState} from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import { validateEmail, validatePhone } from '@/lib/validation';

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
    const { t } = useLanguage();
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

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);
        setErr(null);
        try {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                throw new Error(emailValidation.error || t('admin.userBasic.emailInvalid', 'Некорректный email'));
            }

            const phoneValidation = validatePhone(phone, false);
            if (!phoneValidation.valid) {
                throw new Error(
                    phoneValidation.error ||
                        t(
                            'admin.userBasic.phoneInvalid',
                            'Телефон должен быть в формате E.164, например: +996XXXYYYYYY'
                        )
                );
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

            setMsg(t('admin.userBasic.saved', 'Сохранено'));
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t('admin.userBasic.title', 'Основные данные')}
            </h3>

            <Input
                label={t('admin.userBasic.nameLabel', 'Имя')}
                placeholder={t('admin.userBasic.namePlaceholder', 'Введите имя')}
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                name="full_name"
                autoComplete="name"
            />

            <Input
                label={t('admin.userBasic.emailLabel', 'Email')}
                placeholder="email@example.com"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                name="email"
                autoComplete="email"
            />

            <Input
                label={t('admin.userBasic.phoneLabel', 'Телефон')}
                placeholder="+996XXXXXXXXX"
                type="tel"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                name="phone"
                inputMode="tel"
                pattern="^\+[1-9]\d{7,14}$"
                helperText={t('admin.userBasic.phoneHelper', 'Формат E.164: +996XXXXXXXXX')}
            />

            <div className="flex items-center gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={loading || !changed}
                    isLoading={loading}
                >
                    {loading
                        ? t('admin.userBasic.saving', 'Сохраняю…')
                        : t('admin.userBasic.save', 'Сохранить')}
                </Button>
                {msg && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {msg}
                    </div>
                )}
                {err && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {err}
                    </div>
                )}
                {!changed && !msg && !err && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('admin.userBasic.noChanges', 'Нет изменений')}
                    </span>
                )}
            </div>
        </form>
    );
}

