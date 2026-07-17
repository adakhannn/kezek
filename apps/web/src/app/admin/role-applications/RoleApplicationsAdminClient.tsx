'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { BUSINESS_ROLE_LABELS, type BusinessRoleKey } from '@/lib/businessRoleApplicationService';

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
    businesses: BusinessRelation | BusinessRelation[];
};

type ListResponse = { ok: true; items: ApplicationRow[] } | { ok: false; message?: string };
type MutationResponse = { ok: true } | { ok: false; message?: string };

const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'all'] as const;
type StatusFilter = typeof statuses[number];

const statusLabels: Record<StatusFilter, string> = {
    pending: 'Ожидают',
    approved: 'Одобрены',
    rejected: 'Отклонены',
    cancelled: 'Отменены',
    all: 'Все',
};

export function RoleApplicationsAdminClient() {
    const [items, setItems] = useState<ApplicationRow[]>([]);
    const [status, setStatus] = useState<StatusFilter>('pending');
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function load(nextStatus = status) {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/admin/api/role-applications', window.location.origin);
            url.searchParams.set('status', nextStatus);
            const response = await fetch(url.toString(), { cache: 'no-store' });
            const payload = (await response.json()) as ListResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || 'Не удалось загрузить заявки' : 'Не удалось загрузить заявки');
            }
            setItems(payload.items);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить заявки');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load(status);
    }, [status]);

    async function decide(id: string, action: 'approve' | 'reject') {
        setActionId(`${id}:${action}`);
        setError(null);
        try {
            const response = await fetch(`/admin/api/role-applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const payload = (await response.json()) as MutationResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(!payload.ok ? payload.message || 'Не удалось выполнить действие' : 'Не удалось выполнить действие');
            }
            await load();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Не удалось выполнить действие');
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
                            {statusLabels[item]}
                        </button>
                    ))}
                </div>
            </Card>

            {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            {loading ? <Card padding="lg">Загружаем заявки…</Card> : null}

            {!loading && !items.length ? (
                <EmptyState
                    title="Заявок нет"
                    description="В выбранном статусе пока нет заявок на роли в бизнесах."
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
                                    {application.applicant_name || 'Пользователь Kezek'}
                                </h2>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {application.applicant_email || application.applicant_phone || application.applicant_user_id}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                    {BUSINESS_ROLE_LABELS[application.requested_role]}
                                </span>
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                    {application.status}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-xl bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
                            <div><b>Бизнес:</b> {businessName}{businessSlug ? ` / ${businessSlug}` : ''}</div>
                            <div><b>Заявитель:</b> {application.applicant_user_id}</div>
                            <div><b>Создана:</b> {new Date(application.created_at).toLocaleString('ru-RU')}</div>
                        </div>

                        {application.message ? (
                            <p className="rounded-xl bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
                                {application.message}
                            </p>
                        ) : null}

                        {isPending && isStaffRequest ? (
                            <AlertBanner
                                variant="info"
                                message="Заявку сотрудника принимает владелец бизнеса в своём кабинете с обязательным выбором филиала."
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
                                    Одобрить
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => decide(application.id, 'reject')}
                                    isLoading={actionId === `${application.id}:reject`}
                                >
                                    Отклонить
                                </Button>
                            </div>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
