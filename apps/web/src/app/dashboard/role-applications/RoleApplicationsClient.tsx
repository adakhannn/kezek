'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { BUSINESS_ROLE_LABELS, type BusinessRoleKey } from '@/lib/businessRoleApplicationService';

type ApplicationRow = {
    id: string;
    applicant_user_id: string;
    requested_role: BusinessRoleKey;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    message: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
};

type ListResponse = { ok: true; items: ApplicationRow[] } | { ok: false; message?: string };
type MutationResponse = { ok: true } | { ok: false; message?: string };

const statusLabels: Record<ApplicationRow['status'], string> = {
    pending: 'Ожидает',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    cancelled: 'Отменена',
};

export function RoleApplicationsClient() {
    const [items, setItems] = useState<ApplicationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/dashboard/api/role-applications', { cache: 'no-store' });
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
        void load();
    }, []);

    async function decide(id: string, action: 'approve' | 'reject') {
        setActionId(`${id}:${action}`);
        setError(null);
        try {
            const response = await fetch(`/dashboard/api/role-applications/${id}/status`, {
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

    if (loading) {
        return <Card padding="lg">Загружаем заявки…</Card>;
    }

    return (
        <div className="space-y-4">
            {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            {!items.length ? (
                <EmptyState
                    title="Заявок пока нет"
                    description="Когда владелец, менеджер или сотрудник отправит заявку на доступ к этому бизнесу, она появится здесь."
                />
            ) : null}

            {items.map((application) => {
                const isPending = application.status === 'pending';
                const isOwnerRequest = application.requested_role === 'owner';

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
                                    {statusLabels[application.status]}
                                </span>
                            </div>
                        </div>

                        {application.message ? (
                            <p className="rounded-xl bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
                                {application.message}
                            </p>
                        ) : null}

                        <div className="text-xs text-[var(--text-muted)]">
                            Создана: {new Date(application.created_at).toLocaleString('ru-RU')}
                            {application.reviewed_at ? ` · Рассмотрена: ${new Date(application.reviewed_at).toLocaleString('ru-RU')}` : ''}
                        </div>

                        {isPending && isOwnerRequest ? (
                            <AlertBanner
                                variant="warning"
                                message="Заявку на роль владельца может одобрить только супер-админ."
                            />
                        ) : null}

                        {isPending && !isOwnerRequest ? (
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

                        {application.status === 'approved' && application.requested_role === 'staff' ? (
                            <p className="text-sm text-[var(--text-secondary)]">
                                Если этот пользователь должен работать мастером в расписании, создайте для него карточку в разделе “Сотрудники”.
                            </p>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
