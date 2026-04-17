'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { AdminDataTable } from '../_components/AdminDataTable';
import { AdminFilterBar } from '../_components/AdminFilterBar';
import { AdminPagination } from '../_components/AdminPagination';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type UserListItem = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    is_super: boolean;
    is_blocked: boolean;
    block_reason?: string | null;
};

type UsersClientProps = {
    initialUsers: UserListItem[];
    initialPage: number;
    initialPerPage: number;
    initialTotal: number;
    initialSearch: string;
    initialStatus: string;
    stats: {
        total: number;
        active: number;
        blocked: number;
        super: number;
    };
};

function formatLastSeen(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function UsersClient({
    initialUsers,
    initialPage,
    initialPerPage,
    initialTotal,
    initialSearch,
    initialStatus,
    stats,
}: UsersClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(initialSearch);
    const [status, setStatus] = useState(initialStatus);
    const [perPage, setPerPage] = useState(initialPerPage);
    const [isPending, startTransition] = useTransition();
    const [users, setUsers] = useState(initialUsers);
    const [page, setPage] = useState(initialPage);
    const [total, setTotal] = useState(initialTotal);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setUsers(initialUsers);
        setPage(initialPage);
        setTotal(initialTotal);
        setSearch(initialSearch);
        setStatus(initialStatus);
        setPerPage(initialPerPage);
        setSelectedIds([]);
    }, [initialUsers, initialPage, initialTotal, initialSearch, initialStatus, initialPerPage]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== initialSearch || status !== initialStatus || perPage !== initialPerPage) {
                startTransition(() => {
                    const params = new URLSearchParams();
                    if (search.trim()) params.set('q', search.trim());
                    params.set('status', status);
                    params.set('page', '1');
                    params.set('perPage', String(perPage));
                    router.push(`/admin/users?${params.toString()}`);
                });
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [search, status, perPage, initialSearch, initialStatus, initialPerPage, router]);

    const handlePageChange = useCallback(
        (newPage: number) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(newPage));
            params.set('perPage', String(perPage));
            router.push(`/admin/users?${params.toString()}`);
        },
        [router, searchParams, perPage],
    );

    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
    const selectableIds = useMemo(() => users.map((user) => user.id), [users]);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

    const columns = [
        { key: 'user', label: 'Пользователь' },
        { key: 'contacts', label: 'Контакты' },
        { key: 'lastSeen', label: 'Последний вход' },
        { key: 'status', label: 'Статус' },
        { key: 'actions', label: 'Действия', align: 'right' as const },
    ];

    const rows = users.map((user) => {
        const statusPill = user.is_blocked
            ? 'bg-[color:color-mix(in_srgb,var(--status-danger)_16%,transparent)] text-[var(--status-danger)]'
            : user.is_super
              ? 'bg-[color:color-mix(in_srgb,var(--accent-primary)_16%,transparent)] text-[var(--accent-primary)]'
              : 'bg-[color:color-mix(in_srgb,var(--status-success)_16%,transparent)] text-[var(--status-success)]';

        const statusLabel = user.is_blocked ? 'Заблокирован' : user.is_super ? 'Super Admin' : 'Активен';

        return {
            key: user.id,
            selected: selectedIds.includes(user.id),
            onSelectChange: (checked: boolean) => {
                setSelectedIds((prev) =>
                    checked ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id),
                );
            },
            cells: [
                <div key="user" className="min-w-[220px]">
                    <div className="font-medium text-[var(--text-primary)]">{user.full_name || 'Без имени'}</div>
                    <div className="type-caption mt-1 font-mono text-[var(--text-muted)]">{user.id}</div>
                </div>,
                <div key="contacts" className="min-w-[220px]">
                    <div className="text-sm text-[var(--text-primary)]">{user.email || '—'}</div>
                    <div className="type-caption mt-1 text-[var(--text-secondary)]">{user.phone || '—'}</div>
                    {user.block_reason ? (
                        <div className="mt-1 text-xs text-[var(--status-danger)]">{user.block_reason}</div>
                    ) : null}
                </div>,
                <span key="lastSeen" className="text-sm text-[var(--text-secondary)]">
                    {formatLastSeen(user.last_sign_in_at)}
                </span>,
                <span key="status" className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill}`}>
                    {statusLabel}
                </span>,
                <div key="actions" className="flex justify-end">
                    <Link href={`/admin/users/${user.id}`}>
                        <Button size="sm">Открыть</Button>
                    </Link>
                </div>,
            ],
        };
    });

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Всего пользователей" value={stats.total} />
                <StatCard label="Активных" value={stats.active} tone="success" />
                <StatCard label="Заблокированных" value={stats.blocked} tone="danger" />
                <StatCard label="Super Admin" value={stats.super} tone="accent" />
            </div>

            <AdminFilterBar title="Фильтры пользователей" description="Единая плотность, фильтрация и поведение списка.">
                <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                    <Input
                        type="text"
                        placeholder="Поиск: email, телефон, имя, id"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                    >
                        <option value="all">Все статусы</option>
                        <option value="active">Только активные</option>
                        <option value="blocked">Только заблокированные</option>
                    </select>
                    <select
                        value={String(perPage)}
                        onChange={(event) => setPerPage(Number(event.target.value))}
                        className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                    >
                        <option value="20">20 на страницу</option>
                        <option value="50">50 на страницу</option>
                        <option value="100">100 на страницу</option>
                    </select>
                </div>
            </AdminFilterBar>

            {selectedIds.length > 0 ? (
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-caption text-[var(--text-secondary)]">Выбрано: {selectedIds.length}</p>
                    <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
                            Снять выбор
                        </Button>
                        <Link href={`/admin/users/${selectedIds[0]}`}>
                            <Button size="sm">Открыть первого</Button>
                        </Link>
                    </div>
                </Card>
            ) : null}

            <AdminDataTable
                columns={columns}
                rows={rows}
                compact
                includeSelection
                allSelected={allSelected}
                onToggleAll={(checked) => setSelectedIds(checked ? selectableIds : [])}
                emptyState="Пользователи не найдены. Попробуйте изменить фильтры."
            />

            <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                onPageChange={handlePageChange}
                isBusy={isPending}
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'danger' | 'accent';
}) {
    const valueClassName =
        tone === 'success'
            ? 'text-[var(--status-success)]'
            : tone === 'danger'
              ? 'text-[var(--status-danger)]'
              : tone === 'accent'
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-primary)]';

    return (
        <Card className="p-5">
            <p className="type-caption text-[var(--text-secondary)]">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${valueClassName}`}>{value}</p>
        </Card>
    );
}

