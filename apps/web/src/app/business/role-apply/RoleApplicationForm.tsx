'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { BUSINESS_ROLE_LABELS, type BusinessRoleKey } from '@/lib/businessRoleApplicationService';

type BusinessOption = {
    id: string;
    name: string;
    slug: string | null;
};

type SearchResponse = { ok: true; items: BusinessOption[] } | { ok: false; message?: string };
type SubmitResponse = { ok: true; id: string | null } | { ok: false; message?: string; code?: string };

type RoleApplicationMode = 'owner' | 'staff';

const staffRoleOptions: BusinessRoleKey[] = ['staff', 'manager', 'admin'];

const modeCopy: Record<RoleApplicationMode, {
    defaultRole: BusinessRoleKey;
    allowedRoles: BusinessRoleKey[];
    authTitle: string;
    authMessage: string;
    roleLabel: string;
    roleHint: string;
    commentLabel: string;
    commentPlaceholder: string;
    info: string;
    successPrefix: string;
    signInNext: string;
}> = {
    owner: {
        defaultRole: 'owner',
        allowedRoles: ['owner'],
        authTitle: 'Нужно войти',
        authMessage: 'Заявка владельца привязывается к вашему аккаунту. Войдите через Google, Яндекс, Telegram или WhatsApp, затем вернитесь сюда.',
        roleLabel: 'Роль',
        roleHint: 'Заявки на владельца рассматривает только супер-админ Kezek. После одобрения этот аккаунт станет владельцем бизнеса.',
        commentLabel: 'Как подтвердить, что вы владелец',
        commentPlaceholder: 'Например: я основатель бизнеса, могу подтвердить номером/документами/соцсетями. Укажите, кто может подтвердить заявку.',
        info: 'Если бизнес ещё не создан в Kezek, используйте заявку на подключение нового бизнеса. Эта форма — только для существующих бизнесов.',
        successPrefix: 'Заявка владельца отправлена',
        signInNext: '/business/owner-apply',
    },
    staff: {
        defaultRole: 'staff',
        allowedRoles: staffRoleOptions,
        authTitle: 'Нужно войти',
        authMessage: 'Заявка сотрудника привязывается к вашему аккаунту. Войдите через Google, Яндекс, Telegram или WhatsApp, затем вернитесь сюда.',
        roleLabel: 'Какой доступ вам нужен',
        roleHint: 'Заявки сотрудников, менеджеров и администраторов рассматривает владелец или админ выбранного бизнеса.',
        commentLabel: 'Комментарий для владельца',
        commentPlaceholder: 'Например: я мастер филиала на Киевской, работаю по графику 2/2, меня может подтвердить администратор Алина.',
        info: 'После одобрения появится доступ к бизнесу. Если вы должны быть мастером в расписании, владелец дополнительно создаст карточку сотрудника в разделе “Сотрудники”.',
        successPrefix: 'Заявка на доступ отправлена',
        signInNext: '/business/staff-apply',
    },
};

export function RoleApplicationForm({
    isAuthenticated,
    mode,
}: {
    isAuthenticated: boolean;
    mode: RoleApplicationMode;
}) {
    const copy = modeCopy[mode];
    const [query, setQuery] = useState('');
    const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
    const [bizId, setBizId] = useState('');
    const [role, setRole] = useState<BusinessRoleKey>(copy.defaultRole);
    const [message, setMessage] = useState('');
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const selectedBusiness = useMemo(
        () => businesses.find((business) => business.id === bizId) ?? null,
        [businesses, bizId],
    );

    useEffect(() => {
        setRole(copy.defaultRole);
    }, [copy.defaultRole]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoadingBusinesses(true);
            try {
                const url = new URL('/api/businesses/search', window.location.origin);
                if (query.trim()) url.searchParams.set('q', query.trim());
                const response = await fetch(url.toString(), {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const payload = (await response.json()) as SearchResponse;
                if (!response.ok || !payload.ok) {
                    throw new Error(!payload.ok ? payload.message || 'Не удалось загрузить бизнесы' : 'Не удалось загрузить бизнесы');
                }
                setBusinesses(payload.items);
                if (!bizId && payload.items[0]) {
                    setBizId(payload.items[0].id);
                }
            } catch (loadError) {
                if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
                    setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить бизнесы');
                }
            } finally {
                setLoadingBusinesses(false);
            }
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [bizId, query]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!isAuthenticated) {
            setError('Сначала войдите в аккаунт Kezek, чтобы заявка была привязана именно к вам.');
            return;
        }
        if (!bizId) {
            setError('Выберите бизнес.');
            return;
        }
        if (!copy.allowedRoles.includes(role)) {
            setError('Выберите корректную роль для этой заявки.');
            return;
        }

        setSending(true);
        try {
            const response = await fetch('/api/business-role-applications', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    biz_id: bizId,
                    requested_role: role,
                    message,
                }),
            });
            const payload = (await response.json()) as SubmitResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || 'Не удалось отправить заявку' : 'Не удалось отправить заявку');
            }
            setSuccess(`${copy.successPrefix}${selectedBusiness ? ` в ${selectedBusiness.name}` : ''}.`);
            setMessage('');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить заявку');
        } finally {
            setSending(false);
        }
    }

    return (
        <Card variant="elevated" padding="lg">
            <form onSubmit={submit} className="space-y-5">
                {!isAuthenticated ? (
                    <AlertBanner
                        variant="warning"
                        title={copy.authTitle}
                        message={copy.authMessage}
                    />
                ) : null}

                {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
                {success ? <AlertBanner variant="success" title="Заявка отправлена" message={success} onClose={() => setSuccess(null)} /> : null}

                <Input
                    label="Найти бизнес"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Название или slug бизнеса"
                    helperText="Показываются только уже одобренные бизнесы Kezek."
                />

                <label className="block">
                    <span className="type-label text-[var(--text-primary)]">Бизнес</span>
                    <select
                        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                        value={bizId}
                        onChange={(event) => setBizId(event.target.value)}
                        disabled={loadingBusinesses}
                    >
                        {businesses.map((business) => (
                            <option key={business.id} value={business.id}>
                                {business.name}{business.slug ? ` / ${business.slug}` : ''}
                            </option>
                        ))}
                        {!businesses.length ? <option value="">Бизнесы не найдены</option> : null}
                    </select>
                </label>

                <label className="block">
                    <span className="type-label text-[var(--text-primary)]">{copy.roleLabel}</span>
                    <select
                        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                        value={role}
                        onChange={(event) => setRole(event.target.value as BusinessRoleKey)}
                        disabled={copy.allowedRoles.length === 1}
                    >
                        {copy.allowedRoles.map((option) => (
                            <option key={option} value={option}>{BUSINESS_ROLE_LABELS[option]}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{copy.roleHint}</p>
                </label>

                <label className="block">
                    <span className="type-label text-[var(--text-primary)]">{copy.commentLabel}</span>
                    <textarea
                        className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                        maxLength={2000}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={copy.commentPlaceholder}
                    />
                </label>

                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-[var(--text-secondary)]">
                    {copy.info}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="submit" isLoading={sending} disabled={sending || !isAuthenticated || !bizId}>
                        Отправить заявку
                    </Button>
                    {!isAuthenticated ? (
                        <Link
                            href={`/auth/sign-in?next=${encodeURIComponent(copy.signInNext)}`}
                            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                        >
                            Войти
                        </Link>
                    ) : null}
                    <Link
                        href="/business/role-apply"
                        className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                    >
                        Выбрать другой тип заявки
                    </Link>
                    <Link
                        href="/business/apply"
                        className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                    >
                        Подключить новый бизнес
                    </Link>
                </div>
            </form>
        </Card>
    );
}
