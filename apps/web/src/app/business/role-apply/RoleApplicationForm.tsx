'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { type BusinessRoleKey } from '@/lib/businessRoleApplicationService';

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
    needsProfileName = false,
}: {
    isAuthenticated: boolean;
    mode: RoleApplicationMode;
    needsProfileName?: boolean;
}) {
    const { locale, t } = useLanguage();
    const baseCopy = modeCopy[mode];
    const copy = {
        ...baseCopy,
        authTitle: t('business.roleApply.form.auth.title'),
        authMessage: t(mode === 'owner'
            ? 'business.roleApply.form.auth.ownerMessage'
            : 'business.roleApply.form.auth.staffMessage'),
        roleLabel: t('business.roleApply.form.role.label'),
        roleHint: t(mode === 'owner'
            ? 'business.roleApply.form.role.ownerHint'
            : 'business.roleApply.form.role.staffHint'),
        commentLabel: t(mode === 'owner'
            ? 'business.roleApply.form.comment.ownerLabel'
            : 'business.roleApply.form.comment.staffLabel'),
        commentPlaceholder: t(mode === 'owner'
            ? 'business.roleApply.form.comment.ownerPlaceholder'
            : 'business.roleApply.form.comment.staffPlaceholder'),
        info: t(mode === 'owner'
            ? 'business.roleApply.form.info.owner'
            : 'business.roleApply.form.info.staff'),
        successPrefix: t(mode === 'owner'
            ? 'business.roleApply.form.success.owner'
            : 'business.roleApply.form.success.staff'),
    };
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
    const [isBusinessPickerOpen, setIsBusinessPickerOpen] = useState(false);
    const hasSearchQuery = query.trim().length >= 2;

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
        if (!hasSearchQuery) {
            setBusinesses([]);
            setBizId('');
            setLoadingBusinesses(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoadingBusinesses(true);
            try {
                const url = new URL('/api/businesses/search', window.location.origin);
                url.searchParams.set('q', query.trim());
                const response = await fetch(url.toString(), {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const payload = (await response.json()) as SearchResponse;
                if (!response.ok || !payload.ok) {
                    throw new Error(!payload.ok ? payload.message || 'Не удалось загрузить бизнесы' : 'Не удалось загрузить бизнесы');
                }
                setBusinesses(payload.items);
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
    }, [hasSearchQuery, query]);

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

    function selectBusiness(business: BusinessOption) {
        setBizId(business.id);
        setQuery(business.name);
        setIsBusinessPickerOpen(false);
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
                {success ? <AlertBanner variant="success" title={t('business.roleApply.form.success.title')} message={success} onClose={() => setSuccess(null)} /> : null}

                {myApplications.length ? (
                    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="font-semibold text-[var(--text-primary)]">{t('business.roleApply.form.active.title')}</p>
                        {myApplications.map((application) => {
                            const relation = Array.isArray(application.businesses)
                                ? application.businesses[0] ?? null
                                : application.businesses;
                            return (
                                <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-card)] p-3 text-sm">
                                    <span>
                                        {relation?.name || application.biz_id} · {new Date(application.created_at).toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU')}
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => cancelApplication(application.id)}
                                        isLoading={cancellingId === application.id}
                                    >
                                        {t('business.roleApply.form.active.cancel')}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                {mode === 'staff' && isAuthenticated && needsProfileName ? (
                    <div className="text-sm text-[var(--text-secondary)]">
                        <p>{t('business.roleApply.form.applicant.missingName')}</p>
                        <Link href="/cabinet/profile" className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--accent-primary)] underline underline-offset-4">
                            {t('business.roleApply.form.applicant.edit')}
                        </Link>
                    </div>
                ) : null}

                <div className="relative">
                    <label htmlFor="business-search" className="type-label block text-[var(--text-primary)]">
                        {t('business.roleApply.form.search.label')}
                    </label>
                    <input
                        id="business-search"
                        type="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="business-search-results"
                        aria-expanded={isBusinessPickerOpen && hasSearchQuery}
                        className="mt-2 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:outline-none sm:min-h-[40px] sm:text-sm"
                        value={query}
                        onFocus={() => setIsBusinessPickerOpen(true)}
                        onBlur={() => setIsBusinessPickerOpen(false)}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setBizId('');
                            setIsBusinessPickerOpen(true);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setIsBusinessPickerOpen(false);
                            }
                            if (event.key === 'Enter' && businesses.length === 1) {
                                event.preventDefault();
                                selectBusiness(businesses[0]);
                            }
                        }}
                        placeholder={t('business.roleApply.form.search.placeholder')}
                    />
                    <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                        {t('business.roleApply.form.search.helper')}
                    </p>

                    {isBusinessPickerOpen && hasSearchQuery ? (
                        <div
                            id="business-search-results"
                            role="listbox"
                            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] p-1 shadow-xl"
                        >
                            {loadingBusinesses ? (
                                <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
                                    {t('business.roleApply.form.business.loading')}
                                </p>
                            ) : businesses.length ? businesses.map((business) => (
                                <button
                                    key={business.id}
                                    type="button"
                                    role="option"
                                    aria-selected={bizId === business.id}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => selectBusiness(business)}
                                >
                                    {business.name}{business.slug ? ` / ${business.slug}` : ''}
                                </button>
                            )) : (
                                <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
                                    {t('business.roleApply.form.business.empty')}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>

                {mode === 'owner' ? (
                    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
                        <div>
                            <p className="type-label text-[var(--text-primary)]">{t('business.roleApply.form.evidence.label')}</p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">
                                {t('business.roleApply.form.evidence.helper')}
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

                {mode === 'staff' ? (
                    <div>
                        <p className="text-sm text-[var(--text-secondary)]">{copy.roleLabel}: <span className="font-semibold text-[var(--text-primary)]">{t('business.roleApply.form.role.staff')}</span></p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.roleHint}</p>
                    </div>
                ) : <label className="block">
                    <span className="type-label text-[var(--text-primary)]">{copy.roleLabel}</span>
                    <select
                        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                        value={role}
                        onChange={(event) => setRole(event.target.value as BusinessRoleKey)}
                        disabled={copy.allowedRoles.length === 1}
                    >
                        {copy.allowedRoles.map((option) => (
                            <option key={option} value={option}>
                                {t(`business.roleApply.form.role.${option}`)}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{copy.roleHint}</p>
                </label>}

                {mode === 'staff' ? (
                    <details className="rounded-xl border border-[var(--border-subtle)] p-4">
                        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]">
                            {t('business.roleApply.form.comment.addOptional')}
                        </summary>
                        <label className="mt-2 block">
                            <span className="text-sm text-[var(--text-secondary)]">{copy.commentLabel}</span>
                            <textarea
                                className="mt-2 min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
                                maxLength={2000}
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder={copy.commentPlaceholder}
                            />
                        </label>
                    </details>
                ) : <label className="block">
                    <span className="type-label text-[var(--text-primary)]">{copy.commentLabel}</span>
                    <textarea
                        className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                        maxLength={2000}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={copy.commentPlaceholder}
                    />
                </label>}

                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-[var(--text-secondary)]">
                    {copy.info}
                </div>

                <div className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
                    <Button
                        type="submit"
                        fullWidth
                        className="min-h-12 whitespace-normal text-center"
                        isLoading={sending}
                        disabled={sending || !isAuthenticated || !bizId}
                    >
                        {t('business.roleApply.form.submit')}
                    </Button>
                    {!isAuthenticated ? (
                        <Link
                            href={`/auth/sign-in?next=${encodeURIComponent(copy.signInNext)}`}
                            className="flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-3 text-center text-sm font-medium text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                        >
                            {t('business.roleApply.form.signIn')}
                        </Link>
                    ) : null}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <Link
                        href="/business/role-apply"
                        className="flex min-h-12 min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3 text-center text-sm font-medium leading-snug text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                    >
                        {t('business.roleApply.form.chooseType')}
                    </Link>
                    <Link
                        href="/business/apply"
                        className="flex min-h-12 min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3 text-center text-sm font-medium leading-snug text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                    >
                        {t('business.roleApply.form.connectBusiness')}
                    </Link>
                    </div>
                </div>
            </form>
        </Card>
    );
}
