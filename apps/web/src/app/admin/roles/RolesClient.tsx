'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AdminDataTable } from '../_components/AdminDataTable';
import { AdminFilterBar } from '../_components/AdminFilterBar';
import { AdminPagination } from '../_components/AdminPagination';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
    created_at?: string | null;
};

type ListRes = { ok: true; items: Role[] } | { ok: false; error: string };
type MutRes = { ok: true; id?: string } | { ok: false; error: string };

const PAGE_SIZE = 20;

export default function RolesClient({ baseURL }: { baseURL?: string }) {
    const prefix = baseURL ?? '';
    const api = useMemo(
        () => ({
            list: `${prefix}/admin/api/roles/list`,
            remove: (roleId: string) => `${prefix}/admin/api/roles/${encodeURIComponent(roleId)}/delete`,
        }),
        [prefix],
    );

    const [items, setItems] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmRole, setConfirmRole] = useState<Role | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(api.list, { cache: 'no-store' });
            const json = (await res.json()) as ListRes;
            if (!res.ok || !('ok' in json) || json.ok !== true) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            setItems(json.items);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : String(loadError));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return items;
        return items.filter((role) =>
            [role.key, role.name, role.description ?? ''].some((value) => value.toLowerCase().includes(query)),
        );
    }, [items, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);

    useEffect(() => {
        if (page !== clampedPage) setPage(clampedPage);
    }, [page, clampedPage]);

    const pageItems = useMemo(() => {
        const start = (clampedPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, clampedPage]);

    const allCurrentPageSelected =
        pageItems.length > 0 && pageItems.every((role) => selectedIds.includes(role.id));

    async function onDelete(role: Role) {
        if (role.is_system) {
            setError('Системную роль удалить нельзя.');
            return;
        }

        try {
            setError(null);
            setDeletingId(role.id);
            const res = await fetch(api.remove(role.id), { method: 'POST' });
            const json = (await res.json()) as MutRes;
            if (!res.ok || !json.ok) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            setSelectedIds((prev) => prev.filter((id) => id !== role.id));
            setConfirmRole(null);
            await load();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
        } finally {
            setDeletingId(null);
        }
    }

    async function onBulkDelete() {
        const selectedRoles = items.filter((role) => selectedIds.includes(role.id) && !role.is_system);
        if (selectedRoles.length === 0) {
            setConfirmBulkDelete(false);
            return;
        }

        try {
            setError(null);
            for (const role of selectedRoles) {
                setDeletingId(role.id);
                const res = await fetch(api.remove(role.id), { method: 'POST' });
                const json = (await res.json()) as MutRes;
                if (!res.ok || !json.ok) {
                    throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
                }
            }
            setSelectedIds([]);
            setConfirmBulkDelete(false);
            await load();
        } catch (bulkDeleteError) {
            setError(bulkDeleteError instanceof Error ? bulkDeleteError.message : String(bulkDeleteError));
        } finally {
            setDeletingId(null);
        }
    }

    const columns = [
        { key: 'name', label: 'Роль' },
        { key: 'description', label: 'Описание' },
        { key: 'kind', label: 'Тип' },
        { key: 'createdAt', label: 'Создана' },
        { key: 'actions', label: 'Действия', align: 'right' as const },
    ];

    const rows = pageItems.map((role) => ({
        key: role.id,
        selected: selectedIds.includes(role.id),
        selectable: !role.is_system,
        onSelectChange: (checked: boolean) => {
            setSelectedIds((prev) =>
                checked ? Array.from(new Set([...prev, role.id])) : prev.filter((id) => id !== role.id),
            );
        },
        cells: [
            <div key="name" className="min-w-[200px]">
                <div className="font-medium text-[var(--text-primary)]">{role.name}</div>
                <div className="type-caption mt-1 font-mono text-[var(--text-muted)]">{role.key}</div>
            </div>,
            <span key="description" className="line-clamp-2 text-sm text-[var(--text-secondary)]">
                {role.description || '—'}
            </span>,
            role.is_system ? (
                <span
                    key="kind"
                    className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--accent-primary)_16%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)]"
                >
                    Системная
                </span>
            ) : (
                <span
                    key="kind"
                    className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--status-success)_16%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--status-success)]"
                >
                    Пользовательская
                </span>
            ),
            <span key="createdAt" className="text-sm text-[var(--text-secondary)]">
                {role.created_at ? new Date(role.created_at).toLocaleDateString('ru-RU') : '—'}
            </span>,
            <div key="actions" className="flex justify-end gap-2">
                <Link href={`/admin/roles/${role.id}`}>
                    <Button size="sm">Редактировать</Button>
                </Link>
                <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmRole(role)}
                    disabled={!!role.is_system || deletingId === role.id}
                    isLoading={deletingId === role.id}
                >
                    Удалить
                </Button>
            </div>,
        ],
    }));

    const selectedForBulkDelete = selectedIds.filter((id) => {
        const role = items.find((item) => item.id === id);
        return role && !role.is_system;
    }).length;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <RoleStatCard label="Всего ролей" value={items.length} />
                <RoleStatCard label="Системных" value={items.filter((role) => role.is_system).length} tone="accent" />
                <RoleStatCard
                    label="Пользовательских"
                    value={items.filter((role) => !role.is_system).length}
                    tone="success"
                />
            </div>

            <AdminFilterBar
                title="Поиск ролей"
                description="Единые правила таблицы, действий и пагинации."
                actions={
                    <Link href="/admin/roles/new">
                        <Button size="sm">Создать роль</Button>
                    </Link>
                }
            >
                <Input
                    placeholder="Поиск по ключу, названию или описанию"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </AdminFilterBar>

            {selectedIds.length > 0 ? (
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-caption text-[var(--text-secondary)]">Выбрано: {selectedIds.length}</p>
                    <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
                            Снять выбор
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={selectedForBulkDelete === 0 || deletingId !== null}
                        >
                            Удалить выбранные
                        </Button>
                    </div>
                </Card>
            ) : null}

            <AdminDataTable
                columns={columns}
                rows={rows}
                compact
                includeSelection
                allSelected={allCurrentPageSelected}
                onToggleAll={(checked) =>
                    setSelectedIds((prev) => {
                        const currentPageIds = pageItems.filter((item) => !item.is_system).map((item) => item.id);
                        if (checked) return Array.from(new Set([...prev, ...currentPageIds]));
                        return prev.filter((id) => !currentPageIds.includes(id));
                    })
                }
                emptyState={loading ? 'Загрузка ролей…' : 'Роли не найдены.'}
            />

            <AdminPagination
                page={clampedPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                onPageChange={setPage}
                isBusy={loading}
            />

            {error ? <AlertBanner variant="danger" message={error} compact /> : null}

            <ConfirmDialog
                open={confirmRole !== null}
                onClose={() => setConfirmRole(null)}
                onConfirm={() => confirmRole && onDelete(confirmRole)}
                title="Удалить роль"
                message={confirmRole ? `Удалить роль «${confirmRole.name}»?` : ''}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={deletingId === confirmRole?.id}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                onClose={() => setConfirmBulkDelete(false)}
                onConfirm={onBulkDelete}
                title="Удалить выбранные роли"
                message={`Удалить ролей: ${selectedForBulkDelete}? Системные роли будут пропущены.`}
                confirmLabel="Удалить выбранные"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={deletingId !== null}
            />
        </div>
    );
}

function RoleStatCard({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'accent';
}) {
    const valueClassName =
        tone === 'success'
            ? 'text-[var(--status-success)]'
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

