'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import { QuickActions } from './QuickActions';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { TZ } from '@/lib/time';

type BranchRow = { id: string; name: string };

type BookingItem = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    start_at: string;
    end_at: string;
    branch_id?: string | null;
    services?: { name_ru: string; name_ky?: string | null; name_en?: string | null }[];
    staff?: { full_name: string }[];
    client_name?: string | null;
    client_phone?: string | null;
    servicesSummary?: string;
};

type BookingsListProps = {
    bookings: BookingItem[];
    branches: BranchRow[];
    onConfirm: (id: string) => void;
    onCancel: (id: string) => void;
    onMarkAttendance: (id: string, attended: boolean) => void;
    isLoading: boolean;
    currentPage: number;
    totalCount: number;
    itemsPerPage?: number;
    onPageChange: (page: number) => void;
};

export function BookingsList({
    bookings,
    branches,
    onConfirm,
    onCancel,
    onMarkAttendance,
    isLoading,
    currentPage,
    totalCount,
    itemsPerPage = 30,
    onPageChange,
}: BookingsListProps) {
    const { t, locale } = useLanguage();

    const getServiceName = (service: { name_ru: string; name_ky?: string | null } | undefined): string => {
        if (!service) return '';
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        return service.name_ru;
    };

    const getBranchName = (branchId?: string | null) => {
        if (!branchId) return null;
        return branches.find((branch) => branch.id === branchId)?.name ?? null;
    };

    const getStatusLabel = (booking: BookingItem) => {
        const isPast = new Date(booking.start_at) < new Date();
        if (booking.status === 'no_show') return t('bookings.status.noShowShort', 'не пришел');
        if (booking.status === 'paid' && isPast) return t('bookings.status.attended', 'пришел');
        return t(`bookings.status.${booking.status}`, booking.status);
    };

    if (isLoading) {
        return <div className="py-6 text-center text-sm text-[var(--text-muted)]">{t('bookings.list.loading', 'Загрузка...')}</div>;
    }

    if (bookings.length === 0) {
        return (
            <EmptyState
                title={t('bookings.list.empty', 'Нет бронирований')}
                description={t(
                    'bookings.workspace.emptyHint',
                    'Попробуйте другой пресет, поиск или фильтр по филиалу. История и сегодняшние записи переключаются через один и тот же workspace.',
                )}
                className="border border-dashed border-[var(--border-subtle)] bg-[var(--surface-elevated)]"
            />
        );
    }

    return (
        <>
            <div className="hidden lg:block overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-[96] bg-[var(--surface-emphasis)]">
                        <tr className="border-b border-[var(--border-subtle)]">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.list.service', 'Услуга')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.workspace.client', 'Клиент')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.list.master', 'Мастер')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.list.start', 'Начало')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.list.status', 'Статус')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                {t('bookings.list.actions', 'Действия')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-card)]">
                        {bookings.map((booking) => {
                            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                            const master = Array.isArray(booking.staff) ? booking.staff[0] : booking.staff;
                            const branchName = getBranchName(booking.branch_id);
                            const serviceLabel = booking.servicesSummary || getServiceName(service);

                            return (
                                <tr key={booking.id} className="align-top transition hover:bg-[var(--surface-elevated)]">
                                    <td className="px-4 py-4 text-sm font-mono text-[var(--text-secondary)]">
                                        <Link href={`/booking/${booking.id}`} className="hover:text-[var(--accent-primary)]">
                                            {String(booking.id).slice(0, 8)}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="max-w-[20rem]">
                                            <p className="type-label text-[var(--text-primary)]">{serviceLabel}</p>
                                            {branchName ? <p className="type-caption mt-1 text-[var(--text-muted)]">{branchName}</p> : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="min-w-[12rem]">
                                            <p className="type-label text-[var(--text-primary)]">{booking.client_name || t('bookings.workspace.walkIn', 'Клиент у стойки')}</p>
                                            {booking.client_phone ? (
                                                <p className="type-caption mt-1 text-[var(--text-muted)]">{booking.client_phone}</p>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-[var(--text-secondary)]">{master?.full_name || '—'}</td>
                                    <td className="px-4 py-4">
                                        <div className="min-w-[11rem]">
                                            <p className="type-label text-[var(--text-primary)]">
                                                {formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy')}
                                            </p>
                                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                                {formatInTimeZone(new Date(booking.start_at), TZ, 'HH:mm')} - {formatInTimeZone(new Date(booking.end_at), TZ, 'HH:mm')}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <StatusChip
                                            status={booking.status}
                                            tone="soft"
                                            label={getStatusLabel(booking)}
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <QuickActions
                                            bookingId={booking.id}
                                            status={booking.status}
                                            startAt={booking.start_at}
                                            onConfirm={onConfirm}
                                            onCancel={onCancel}
                                            onMarkAttendance={onMarkAttendance}
                                            compact
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="space-y-3 lg:hidden">
                {bookings.map((booking) => {
                    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                    const master = Array.isArray(booking.staff) ? booking.staff[0] : booking.staff;
                    const branchName = getBranchName(booking.branch_id);
                    const serviceLabel = booking.servicesSummary || getServiceName(service);

                    return (
                        <div
                            key={booking.id}
                            className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-sm)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link href={`/booking/${booking.id}`} className="type-caption font-mono text-[var(--accent-primary)] hover:underline">
                                        #{String(booking.id).slice(0, 8)}
                                    </Link>
                                    <p className="type-label mt-1 text-[var(--text-primary)]">{serviceLabel || '—'}</p>
                                    {branchName ? <p className="type-caption mt-1 text-[var(--text-muted)]">{branchName}</p> : null}
                                </div>
                                <StatusChip status={booking.status} tone="soft" label={getStatusLabel(booking)} />
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-3">
                                    <p className="type-caption text-[var(--text-secondary)]">{t('bookings.workspace.client', 'Клиент')}</p>
                                    <p className="type-label mt-1 text-[var(--text-primary)]">{booking.client_name || t('bookings.workspace.walkIn', 'Клиент у стойки')}</p>
                                    {booking.client_phone ? (
                                        <p className="type-caption mt-1 text-[var(--text-muted)]">{booking.client_phone}</p>
                                    ) : null}
                                </div>
                                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-3">
                                    <p className="type-caption text-[var(--text-secondary)]">{t('bookings.list.master', 'Мастер')}</p>
                                    <p className="type-label mt-1 text-[var(--text-primary)]">{master?.full_name || '—'}</p>
                                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                                        {formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy')} • {formatInTimeZone(new Date(booking.start_at), TZ, 'HH:mm')}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                                <QuickActions
                                    bookingId={booking.id}
                                    status={booking.status}
                                    startAt={booking.start_at}
                                    onConfirm={onConfirm}
                                    onCancel={onCancel}
                                    onMarkAttendance={onMarkAttendance}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {totalCount > itemsPerPage ? (
                <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-caption text-[var(--text-muted)]">
                        {t('bookings.list.paginationInfo', 'Показано')} {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, totalCount)} {t('bookings.list.of', 'из')} {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1 || isLoading}
                            variant="outline"
                            size="sm"
                        >
                            {t('bookings.list.prev', 'Назад')}
                        </Button>
                        <span className="type-caption px-2 text-[var(--text-secondary)]">
                            {t('bookings.list.page', 'Страница')} {currentPage} {t('bookings.list.of', 'из')} {Math.ceil(totalCount / itemsPerPage)}
                        </span>
                        <Button
                            onClick={() => onPageChange(Math.min(Math.ceil(totalCount / itemsPerPage), currentPage + 1))}
                            disabled={currentPage >= Math.ceil(totalCount / itemsPerPage) || isLoading}
                            variant="outline"
                            size="sm"
                        >
                            {t('bookings.list.next', 'Вперед')}
                        </Button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
