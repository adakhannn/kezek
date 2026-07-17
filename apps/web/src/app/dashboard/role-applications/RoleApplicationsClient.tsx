'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

    async function decide(id: string, action: 'approve' | 'reject', blockDays = 0) {
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
                    : ' Карточка создана, но расписание нужно проверить вручную.';
                setNotice(`Сотрудник принят и получил рабочий кабинет.${scheduleText}`);
            } else {
                setNotice('Заявка сотрудника отклонена.');
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
                                <p className="text-sm text-[var(--text-muted)]">
                                    {application.applicant_email || application.applicant_phone || application.applicant_user_id}
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

                        {application.prior_submission_count > 0 || application.risk_flags.length ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-300">
                                    Предыдущих заявок: {application.prior_submission_count}
                                </span>
                                {application.risk_flags.map((flag) => (
                                    <span key={flag} className="rounded-full bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">{flag}</span>
                                ))}
                            </div>
                        ) : null}

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
                            <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4">
                                <div>
                                    <label htmlFor={`branch-${application.id}`} className="type-label text-[var(--text-primary)]">
                                        Филиал сотрудника
                                    </label>
                                    <select
                                        id={`branch-${application.id}`}
                                        value={branchId}
                                        onChange={(event) => setBranchId(event.target.value)}
                                        className="mt-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                                    >
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}{branch.address ? ` · ${branch.address}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <label className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(event) => setIsActive(event.target.checked)}
                                        className="mt-1 h-4 w-4"
                                    />
                                    <span>
                                        <b className="text-[var(--text-primary)]">Активировать сотрудника сразу</b><br />
                                        Активный сотрудник получит рабочий кабинет. Услуги можно назначить после принятия.
                                    </span>
                                </label>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => decide(application.id, 'approve')}
                                        isLoading={actionId === `${application.id}:approve`}
                                    >
                                        Принять сотрудника
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingId(null)}
                                        disabled={actionId !== null}
                                    >
                                        Отмена
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
