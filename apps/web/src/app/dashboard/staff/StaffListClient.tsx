'use client';

import Link from 'next/link';
import { useMemo, useState, useCallback } from 'react';

import ActionButtons from './ActionButtons';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type StaffRow = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    branches: { name: string } | null;
};

type Props = {
    initialRows: StaffRow[];
};

export default function StaffListClient({ initialRows }: Props) {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Пагинация для больших списков (показываем по 30 элементов на странице)
    const ITEMS_PER_PAGE = 30;
    const [currentPage, setCurrentPage] = useState(1);
    
    // Сбрасываем страницу при изменении фильтров
    const handleFilterChange = useCallback(() => {
        setCurrentPage(1);
    }, []);
    
    // Обработчики для фильтров с сбросом пагинации
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        handleFilterChange();
    }, [handleFilterChange]);

    const handleStatusChange = useCallback((status: 'all' | 'active' | 'inactive') => {
        setFilterStatus(status);
        handleFilterChange();
    }, [handleFilterChange]);

    // Фильтрация и поиск
    const filteredRows = useMemo(() => {
        let result = initialRows;

        // Поиск по имени
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter((r) => r.full_name.toLowerCase().includes(query));
        }

        // Фильтр по статусу
        if (filterStatus === 'active') {
            result = result.filter((r) => r.is_active === true);
        } else if (filterStatus === 'inactive') {
            result = result.filter((r) => r.is_active !== true);
        }

        return result;
    }, [initialRows, searchQuery, filterStatus]);

    // Мемоизируем подсчет статистики для оптимизации производительности
    const { activeCount, inactiveCount, totalCount } = useMemo(() => {
        const active = initialRows.filter((r) => r.is_active === true).length;
        const inactive = initialRows.filter((r) => r.is_active !== true).length;
        const total = initialRows.length;
        return { activeCount: active, inactiveCount: inactive, totalCount: total };
    }, [initialRows]);

    const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
    
    // Мемоизируем пагинированные элементы
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredRows.slice(start, end);
    }, [filteredRows, currentPage, ITEMS_PER_PAGE]);

    // Обработчики для пагинации
    const handlePrevPage = useCallback(() => {
        setCurrentPage((prev) => Math.max(1, prev - 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    }, [totalPages]);

    return (
        <div className="space-y-6">
            {/* Статистика и фильтры */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm dark:bg-emerald-950/30">
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">{t('staff.stats.active', 'Активных:')}</span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">{activeCount}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t('staff.stats.total', 'Всего:')}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount}</span>
                    </div>
                    {inactiveCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm dark:bg-amber-950/30">
                            <span className="font-medium text-amber-700 dark:text-amber-300">{t('staff.stats.inactive', 'Неактивных:')}</span>
                            <span className="font-semibold text-amber-900 dark:text-amber-100">{inactiveCount}</span>
                        </div>
                    )}
                </div>

                {/* Поиск и фильтры */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder={t('staff.search.placeholder', 'Поиск по имени...')}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 sm:w-64"
                        />
                    </div>

                    <div className="flex rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <button
                            type="button"
                            onClick={() => handleStatusChange('all')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'all'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.filter.all', 'Все')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleStatusChange('active')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'active'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.filter.active', 'Активные')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleStatusChange('inactive')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'inactive'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.filter.inactive', 'Неактивные')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Список сотрудников */}
            {filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                    <p className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {searchQuery || filterStatus !== 'all'
                            ? t('staff.empty.notFound', 'Сотрудники не найдены')
                            : t('staff.empty.noStaff', 'Пока нет сотрудников')}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {searchQuery || filterStatus !== 'all'
                            ? t('staff.empty.notFoundDesc', 'Попробуйте изменить параметры поиска или фильтры')
                            : t('staff.empty.noStaffDesc', 'Добавьте первого сотрудника, чтобы начать работу')}
                    </p>
                    {!searchQuery && filterStatus === 'all' && (
                        <Link
                            href="/dashboard/staff/new"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('staff.empty.addStaff', 'Добавить сотрудника')}
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {paginatedRows.map((staff) => (
                        <div
                            key={staff.id}
                            className={`group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
                                staff.is_active
                                    ? 'border-emerald-200 dark:border-emerald-900/40'
                                    : 'border-gray-200 opacity-75 dark:border-gray-800'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                                            {staff.full_name
                                                .split(' ')
                                                .map((n) => n[0])
                                                .join('')
                                                .toUpperCase()
                                                .slice(0, 2) || '??'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                {staff.full_name}
                                            </h3>
                                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                                {staff.branches?.name ?? t('staff.card.branchNotSet', 'Филиал не указан')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    {staff.is_active ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            {t('staff.card.status.active', 'Активен')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                            {t('staff.card.status.inactive', 'Скрыт')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                                <Link
                                    href={`/dashboard/staff/${staff.id}`}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    {t('staff.card.open', 'Открыть')}
                                </Link>
                                <ActionButtons id={String(staff.id)} isActive={!!staff.is_active} />
                            </div>
                        </div>
                        ))}
                    </div>
                    
                    {/* Пагинация - показываем только если элементов больше чем на одной странице */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {t('staff.pagination.showing', 'Показано')} {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} {t('staff.pagination.of', 'из')} {filteredRows.length}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                                >
                                    {t('staff.pagination.prev', 'Назад')}
                                </button>
                                <span className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                                >
                                    {t('staff.pagination.next', 'Вперед')}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

