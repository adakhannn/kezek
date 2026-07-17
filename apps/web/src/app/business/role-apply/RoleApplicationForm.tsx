'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
type MyApplication = {
    id: string;
    biz_id: string;
    requested_role: 'owner' | 'staff';
    status: 'pending';
    created_at: string;
    businesses: { name: string | null; slug: string | null } | Array<{ name: string | null; slug: string | null }> | null;
};
type MyApplicationsResponse = { ok: true; items: MyApplication[] } | { ok: false; message?: string };

type RoleApplicationMode = 'owner' | 'staff';

const staffRoleOptions: BusinessRoleKey[] = ['staff'];

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
        roleLabel: 'Роль',
        roleHint: 'Заявку сотрудника рассматривает владелец выбранного бизнеса.',
        commentLabel: 'Комментарий для владельца',
        commentPlaceholder: 'Например: я мастер филиала на Киевской, работаю по графику 2/2, меня может подтвердить администратор Алина.',
        info: 'При одобрении владелец выберет филиал. Система создаст рабочую карточку, назначит роль сотрудника и подготовит расписание.',
        successPrefix: 'Заявка сотрудника отправлена',
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
    const [evidenceLinks, setEvidenceLinks] = useState({
        instagram: '',
        two_gis: '',
        google_maps: '',
        yandex_maps: '',
    });
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const selectedBusiness = useMemo(
        () => businesses.find((business) => business.id === bizId) ?? null,
        [businesses, bizId],
    );

    const loadMyApplications = useCallback(async () => {
        if (!isAuthenticated) {
            setMyApplications([]);
            return;
        }
        try {
            const response = await fetch(`/api/business-role-applications?requested_role=${mode}`, { cache: 'no-store' });
            const raw = await response.text();
            const payload = raw
                ? JSON.parse(raw) as MyApplicationsResponse
                : { ok: false as const, message: 'Сервис заявок вернул пустой ответ.' };
            if (response.ok && payload.ok) {
                setMyApplications(payload.items);
            } else if (!payload.ok) {
                setError(payload.message || 'Не удалось загрузить активные заявки.');
            }
        } catch {
            setError('Не удалось загрузить активные заявки. Попробуйте обновить страницу.');
        }
    }, [isAuthenticated, mode]);

    useEffect(() => {
        setRole(copy.defaultRole);
    }, [copy.defaultRole]);

    useEffect(() => {
        void loadMyApplications();
    }, [loadMyApplications]);

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
        if (
            mode === 'owner'
            && message.trim().length < 20
            && !Object.values(evidenceLinks).some((value) => value.trim())
        ) {
            setError('Для заявки владельца добавьте подробное пояснение или хотя бы одну подтверждающую ссылку.');
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
                    evidence_links: evidenceLinks,
                }),
            });
            const payload = (await response.json()) as SubmitResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || 'Не удалось отправить заявку' : 'Не удалось отправить заявку');
            }
            setSuccess(`${copy.successPrefix}${selectedBusiness ? ` в ${selectedBusiness.name}` : ''}.`);
            setMessage('');
            setEvidenceLinks({ instagram: '', two_gis: '', google_maps: '', yandex_maps: '' });
            await loadMyApplications();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить заявку');
        } finally {
            setSending(false);
        }
    }

    async function cancelApplication(applicationId: string) {
        setCancellingId(applicationId);
        setError(null);
        try {
            const response = await fetch(`/api/business-role-applications/${applicationId}`, { method: 'DELETE' });
            const payload = (await response.json()) as { ok?: boolean; message?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось отозвать заявку.');
            setMyApplications((current) => current.filter((application) => application.id !== applicationId));
            setSuccess('Заявка отозвана. Теперь вы можете отправить другую.');
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'Не удалось отозвать заявку.');
        } finally {
            setCancellingId(null);
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

                {myApplications.length ? (
                    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="font-semibold text-[var(--text-primary)]">Ваши активные заявки</p>
                        {myApplications.map((application) => {
                            const relation = Array.isArray(application.businesses)
                                ? application.businesses[0] ?? null
                                : application.businesses;
                            return (
                                <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-card)] p-3 text-sm">
                                    <span>
                                        {relation?.name || application.biz_id} · {new Date(application.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => cancelApplication(application.id)}
                                        isLoading={cancellingId === application.id}
                                    >
                                        Отозвать
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

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

                {mode === 'owner' ? (
                    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
                        <div>
                            <p className="type-label text-[var(--text-primary)]">Ссылки для подтверждения</p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">
                                Добавьте хотя бы одну страницу бизнеса или подробно опишите вашу связь с ним в комментарии.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {([
                                ['instagram', 'Instagram'],
                                ['two_gis', '2ГИС'],
                                ['google_maps', 'Google Карты'],
                                ['yandex_maps', 'Яндекс Карты'],
                            ] as const).map(([key, label]) => (
                                <Input
                                    key={key}
                                    type="url"
                                    label={label}
                                    value={evidenceLinks[key]}
                                    onChange={(event) => setEvidenceLinks((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                    }))}
                                    placeholder="https://..."
                                />
                            ))}
                        </div>
                    </div>
                ) : null}

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
