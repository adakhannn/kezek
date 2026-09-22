'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApplicationBranchSelect } from './ApplicationBranchSelect';
import { ApplicationHistoryNotice } from './ApplicationHistoryNotice';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

type ApplicationRow = {
    id: string;
    applicant_user_id: string;
    requested_role: 'staff';
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    applicant_name: string | null;
    applicant_email: string | null;
    applicant_phone: string | null;
    message: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    prior_submission_count: number;
    risk_flags: string[];
    active_block_id: string | null;
};

type BranchRow = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
};

type ListResponse =
    | { ok: true; items: ApplicationRow[]; branches: BranchRow[] }
    | { ok: false; message?: string };

type MutationResponse = {
    ok: boolean;
    message?: string;
    staff_id?: string;
    schedule_initialized?: boolean;
    schedule_days_created?: number;
    schedule_error?: string | null;
};

const statusLabels: Record<ApplicationRow['status'], string> = {
    pending: 'Ожидает решения',
    approved: 'Принят',
    rejected: 'Отклонён',
    cancelled: 'Отменён',
};

export function RoleApplicationsClient() {
    const [items, setItems] = useState<ApplicationRow[]>([]);
    const [branches, setBranches] = useState<BranchRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [branchId, setBranchId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

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
            setBranches(payload.branches);
            setBranchId((current) => current || payload.branches[0]?.id || '');
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить заявки');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    function startApproval(applicationId: string) {
        setError(null);
        setNotice(null);
        setEditingId(applicationId);
        setBranchId(branches[0]?.id || '');
        setIsActive(true);
    }

    async function decide(id: string, action: 'approve' | 'reject' | 'unblock', blockDays = 0, blockId?: string) {
        if (action === 'approve' && !branchId) {
            setError('Сначала создайте активный филиал и выберите его для сотрудника.');
            return;
        }

        setActionId(`${id}:${action}`);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(`/dashboard/api/role-applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action,
                    note: action === 'reject' ? rejectNote : undefined,
                    block_days: action === 'reject' ? blockDays : undefined,
                    block_id: blockId,
                    ...(action === 'approve' ? { branch_id: branchId, is_active: isActive } : {}),
                }),
            });
            const payload = (await response.json()) as MutationResponse;
            if (!response.ok || !payload.ok) {
                throw new Error(payload.message || 'Не удалось выполнить действие');
            }

            if (action === 'approve') {
                const scheduleText = payload.schedule_initialized
                    ? ` Расписание подготовлено на ${payload.schedule_days_created ?? 0} дней.`
                    : ' Настройте рабочий график в карточке сотрудника, чтобы открыть запись клиентов.';
                setNotice(`Сотрудник принят и получил рабочий кабинет.${scheduleText}`);
            } else if (action === 'reject') {
                setNotice('Заявка сотрудника отклонена.');
            } else {
                setNotice('Блокировка подачи заявок снята.');
            }
            setEditingId(null);
            setRejectingId(null);
            setRejectNote('');
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
            {notice ? <AlertBanner variant="success" message={notice} onClose={() => setNotice(null)} /> : null}

            {!branches.length ? (
                <AlertBanner
                    variant="warning"
                    title="Нужен филиал"
                    message="Принять сотрудника можно только после создания активного филиала."
                    action={(
                        <Link href="/dashboard/branches" className="font-semibold underline">
                            Перейти к филиалам
                        </Link>
                    )}
                />
            ) : null}

            {!items.length ? (
                <EmptyState
                    title="Заявок сотрудников пока нет"
                    description="Когда человек отправит заявку на работу в этом бизнесе, она появится здесь."
                />
            ) : null}

            {items.map((application) => {
                const isPending = application.status === 'pending';
                const isEditing = editingId === application.id;

                return (
                    <Card key={application.id} variant="outlined" padding="md" className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                    {application.applicant_name || 'Пользователь Kezek'}
                                </h2>
                                <p className="break-words text-sm text-[var(--text-muted)]">
                                    {[application.applicant_email, application.applicant_phone].filter(Boolean).join(' · ') || application.applicant_user_id}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                    Сотрудник
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

                        <ApplicationHistoryNotice count={application.prior_submission_count} flags={application.risk_flags ?? []} />

                        {isPending && !isEditing ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => startApproval(application.id)}
                                    disabled={!branches.length}
                                >
                                    Настроить и принять
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
                                    Отклонить
                                </Button>
                            </div>
                        ) : null}

                        {isPending && rejectingId === application.id ? (
                            <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4">
                                <textarea
                                    value={rejectNote}
                                    onChange={(event) => setRejectNote(event.target.value)}
                                    maxLength={1000}
                                    placeholder="Укажите причину отклонения"
                                    className="min-h-24 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-sm"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" disabled={!rejectNote.trim()} onClick={() => decide(application.id, 'reject')}>
                                        Отклонить
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" disabled={!rejectNote.trim()} onClick={() => decide(application.id, 'reject', 30)}>
                                        Отклонить и блокировать 30 дней
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setRejectingId(null)}>
                                        Отмена
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {isPending && isEditing ? (
                            <div className="min-w-0 space-y-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4 sm:p-5">
                                <ApplicationBranchSelect id={`branch-${application.id}`} branches={branches}
                                    value={branchId} onChange={setBranchId} disabled={actionId !== null} />

                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(event) => setIsActive(event.target.checked)}
                                        disabled={actionId !== null}
                                        className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                                    />
                                    <span>
                                        <b className="text-[var(--text-primary)]">Активировать сотрудника сразу</b><br />
                                        Активный сотрудник получит рабочий кабинет. Услуги можно назначить после принятия.
                                    </span>
                                </label>

                                <div className="flex flex-col gap-3 border-t border-[var(--border-default)] pt-4 sm:flex-row">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => decide(application.id, 'approve')}
                                        className="min-h-11 w-full justify-center sm:w-auto"
                                        disabled={actionId !== null || !branchId}
                                        isLoading={actionId === `${application.id}:approve`}
                                    >
                                        Принять сотрудника
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingId(null)}
                                        className="min-h-11 w-full justify-center sm:w-auto"
                                        disabled={actionId !== null}
                                    >
                                        Отмена
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {application.active_block_id ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                                <span className="text-sm text-amber-800 dark:text-amber-200">Подача заявок этого пользователя в бизнес заблокирована.</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => decide(application.id, 'unblock', 0, application.active_block_id ?? undefined)}
                                    isLoading={actionId === `${application.id}:unblock`}
                                >
                                    Снять блокировку
                                </Button>
                            </div>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
