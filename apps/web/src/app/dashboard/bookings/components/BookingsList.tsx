/**
 * Компонент для отображения списка бронирований
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import { BookingActions } from './BookingActions';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';


type BranchRow = { id: string; name: string };

type BookingItem = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    start_at: string;
    end_at: string;
    services?: { name_ru: string; name_ky?: string | null }[];
    staff?: { full_name: string }[];
    client_name?: string | null;
    client_phone?: string | null;
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

    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    if (isLoading) {
        return (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                {t('bookings.list.loading', 'Загрузка...')}
            </div>
        );
    }

    if (bookings.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">{t('bookings.list.empty', 'Нет бронирований')}</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-[96]">
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">#</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.service', 'Услуга')}</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.master', 'Мастер')}</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.start', 'Начало')}</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.status', 'Статус')}</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.actions', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {bookings.map((b) => {
                            const service = Array.isArray(b.services) ? b.services[0] : b.services;
                            const master = Array.isArray(b.staff) ? b.staff[0] : b.staff;
                            const isPast = new Date(b.start_at) < new Date();
                            const canMarkAttendance = isPast && b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'paid';

                            return (
                                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="p-3 lg:p-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                                        <Link href={`/booking/${b.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                                            {String(b.id).slice(0, 8)}
                                        </Link>
                                    </td>
                                    <td className="p-3 lg:p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{getServiceName(service)}</td>
                                    <td className="p-3 lg:p-4 text-sm text-gray-700 dark:text-gray-300">{master?.full_name}</td>
                                    <td className="p-3 lg:p-4 text-sm text-gray-700 dark:text-gray-300">{formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}</td>
                                    <td className="p-3 lg:p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                                            {b.status === 'no_show' ? t('bookings.status.noShowShort', 'не пришел') : b.status === 'paid' && isPast ? t('bookings.status.attended', 'пришел') : t(`bookings.status.${b.status}`, b.status)}
                                        </span>
                                    </td>
                                    <td className="p-3 lg:p-4">
                                        <BookingActions
                                            bookingId={b.id}
                                            status={b.status}
                                            startAt={b.start_at}
                                            onConfirm={onConfirm}
                                            onCancel={onCancel}
                                            onMarkAttendance={onMarkAttendance}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {bookings.map((b) => {
                    const service = Array.isArray(b.services) ? b.services[0] : b.services;
                    const master = Array.isArray(b.staff) ? b.staff[0] : b.staff;
                    const isPast = new Date(b.start_at) < new Date();
                    const canMarkAttendance = isPast && b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'paid';

                    return (
                        <div key={b.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <Link href={`/booking/${b.id}`} className="text-sm font-mono text-indigo-600 dark:text-indigo-400 hover:underline">
                                        #{String(b.id).slice(0, 8)}
                                    </Link>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{getServiceName(service)}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{master?.full_name}</p>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                                    {b.status === 'no_show' ? t('bookings.status.noShowShort', 'не пришел') : b.status === 'paid' && isPast ? t('bookings.status.attended', 'пришел') : t(`bookings.status.${b.status}`, b.status)}
                                </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                {formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}
                            </div>
                            <BookingActions
                                bookingId={b.id}
                                status={b.status}
                                startAt={b.start_at}
                                onConfirm={onConfirm}
                                onCancel={onCancel}
                                onMarkAttendance={onMarkAttendance}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalCount !== undefined && currentPage !== undefined && onPageChange && totalCount > itemsPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('bookings.list.paginationInfo', 'Показано')} {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} {t('bookings.list.of', 'из')} {totalCount}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1 || isLoading}
                            className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {t('bookings.list.prev', 'Назад')}
                        </button>
                        <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                            {t('bookings.list.page', 'Страница')} {currentPage} {t('bookings.list.of', 'из')} {Math.ceil(totalCount / itemsPerPage)}
                        </span>
                        <button
                            onClick={() => onPageChange(Math.min(Math.ceil(totalCount / itemsPerPage), currentPage + 1))}
                            disabled={currentPage >= Math.ceil(totalCount / itemsPerPage) || isLoading}
                            className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {t('bookings.list.next', 'Вперед')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

