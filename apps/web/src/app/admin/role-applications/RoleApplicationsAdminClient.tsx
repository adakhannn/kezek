'use client';

import { useEffect, useState } from 'react';

import { useLanguage, type I18nKey } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { type BusinessRoleKey } from '@/lib/businessRoleApplicationService';

type BusinessRelation = { name: string | null; slug: string | null } | null;

type ApplicationRow = {
    id: string;
    applicant_user_id: string;
    biz_id: string;
    requested_role: BusinessRoleKey;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    message: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    evidence_links: Record<string, string | null>;
    prior_submission_count: number;
    risk_flags: string[];
    active_block_id: string | null;
    businesses: BusinessRelation | BusinessRelation[];
};

type ListResponse = { ok: true; items: ApplicationRow[] } | { ok: false; message?: string };
type MutationResponse = { ok: true } | { ok: false; message?: string };

const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'all'] as const;
type StatusFilter = typeof statuses[number];

const statusLabelKeys: Record<StatusFilter, I18nKey> = {
    pending: 'admin.roleApplications.status.pending',
    approved: 'admin.roleApplications.status.approved',
    rejected: 'admin.roleApplications.status.rejected',
    cancelled: 'admin.roleApplications.status.cancelled',
    all: 'admin.roleApplications.status.all',
};

const roleLabelKeys: Record<BusinessRoleKey, I18nKey> = {
    owner: 'admin.roleApplications.role.owner',
    admin: 'admin.roleApplications.role.admin',
    manager: 'admin.roleApplications.role.manager',
    staff: 'admin.roleApplications.role.staff',
};

export function RoleApplicationsAdminClient() {
    const { locale, t } = useLanguage();
    const [items, setItems] = useState<ApplicationRow[]>([]);
    const [status, setStatus] = useState<StatusFilter>('pending');
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    async function load(nextStatus = status) {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/admin/api/role-applications', window.location.origin);
            url.searchParams.set('status', nextStatus);
            const response = await fetch(url.toString(), { cache: 'no-store' });
            const payload = (await response.json()) as ListResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || t('admin.roleApplications.error.load') : t('admin.roleApplications.error.load'));
            }
            setItems(payload.items);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : t('admin.roleApplications.error.load'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load(status);
    }, [status, locale]);

    async function decide(id: string, action: 'approve' | 'reject' | 'unblock', blockDays = 0, blockId?: string) {
        setActionId(`${id}:${action}`);
        setError(null);
        try {
            const response = await fetch(`/admin/api/role-applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action, note: rejectNote, block_days: blockDays, block_id: blockId }),
            });
            const payload = (await response.json()) as MutationResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || t('admin.roleApplications.error.action') : t('admin.roleApplications.error.action'));
            }
            await load();
            setRejectingId(null);
            setRejectNote('');
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : t('admin.roleApplications.error.action'));
        } finally {
            setActionId(null);
        }
    }

    return (
        <div className="space-y-5">
            <Card variant="outlined" padding="md">
                <div className="flex flex-wrap gap-2">
                    {statuses.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setStatus(item)}
                            className={[
                                'rounded-full px-4 py-2 text-sm font-medium transition',
                                status === item
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-[var(--surface-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                            ].join(' ')}
                        >
                            {t(statusLabelKeys[item])}
                        </button>
                    ))}
                </div>
            </Card>

            {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            {loading ? <Card padding="lg">{t('admin.roleApplications.loading')}</Card> : null}

            {!loading && !items.length ? (
                <EmptyState
                    title={t('admin.roleApplications.empty.title')}
                    description={t('admin.roleApplications.empty.description')}
                />
            ) : null}

            {!loading && items.map((application) => {
                const business = Array.isArray(application.businesses)
                    ? application.businesses[0] ?? null
                    : application.businesses;
                const businessName = business?.name || application.biz_id;
                const businessSlug = business?.slug;
                const isPending = application.status === 'pending';
                const isStaffRequest = application.requested_role === 'staff';

                return (
                    <Card key={application.id} variant="outlined" padding="md" className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                    {application.applicant_name || t('admin.roleApplications.userFallback')}
                                </h2>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {application.applicant_email || application.applicant_phone || application.applicant_user_id}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                    {t(roleLabelKeys[application.requested_role])}
                                </span>
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                    {application.status}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-xl bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
                            <div><b>{t('admin.roleApplications.business')}:</b> {businessName}{businessSlug ? ` / ${businessSlug}` : ''}</div>
                            <div><b>{t('admin.roleApplications.applicant')}:</b> {application.applicant_user_id}</div>
                            <div>
                                <b>{t('admin.roleApplications.created')}:</b>{' '}
                                {new Date(application.created_at).toLocaleString(
                                    locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU'
                                )}
                            </div>
                        </div>

                        {application.message ? (
                            <p className="rounded-xl bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
                                {application.message}
                            </p>
                        ) : null}

                        {Object.values(application.evidence_links ?? {}).some(Boolean) ? (
                            <div className="flex flex-wrap gap-2 text-sm">
                                {Object.entries(application.evidence_links).map(([key, value]) => value ? (
                                    <a key={key} href={value} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
                                        {key}
                                    </a>
                                ) : null)}
                            </div>
                        ) : null}

                        {application.prior_submission_count > 0 || application.risk_flags.length ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-300">
                                    {t('admin.roleApplications.previousCount').replace('{count}', String(application.prior_submission_count))}
                                </span>
                                {application.risk_flags.map((flag) => (
                                    <span key={flag} className="rounded-full bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">{flag}</span>
                                ))}
                            </div>
                        ) : null}

                        {isPending && isStaffRequest ? (
                            <AlertBanner
                                variant="info"
                                message={t('admin.roleApplications.staffNotice')}
                            />
                        ) : null}

                        {isPending && !isStaffRequest ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => decide(application.id, 'approve')}
                                    isLoading={actionId === `${application.id}:approve`}
                                >
                                    {t('admin.roleApplications.approve')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setRejectingId(application.id);
                                        setRejectNote('');
                                    }}
                                    isLoading={actionId === `${application.id}:reject`}
                                >
                                    {t('admin.roleApplications.reject')}
                                </Button>
                            </div>
                        ) : null}

                        {isPending && !isStaffRequest && rejectingId === application.id ? (
                            <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4">
                                <textarea
                                    value={rejectNote}
                                    onChange={(event) => setRejectNote(event.target.value)}
                                    maxLength={1000}
                                    placeholder={t('admin.roleApplications.rejectReason')}
                                    className="min-h-24 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-sm"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" disabled={!rejectNote.trim()} onClick={() => decide(application.id, 'reject')}>
                                        {t('admin.roleApplications.reject')}
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" disabled={!rejectNote.trim()} onClick={() => decide(application.id, 'reject', 30)}>
                                        {t('admin.roleApplications.rejectAndBlock')}
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setRejectingId(null)}>
                                        {t('admin.roleApplications.cancel')}
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {application.active_block_id ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                                <span className="text-sm text-amber-800 dark:text-amber-200">
                                    {t('admin.roleApplications.blocked')}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => decide(application.id, 'unblock', 0, application.active_block_id ?? undefined)}
                                    isLoading={actionId === `${application.id}:unblock`}
                                >
                                    {t('admin.roleApplications.unblock')}
                                </Button>
                            </div>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
