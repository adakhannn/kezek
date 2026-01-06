'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import ActionButtons from './ActionButtons';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

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

    const activeCount = initialRows.filter((r) => r.is_active === true).length;
    const inactiveCount = initialRows.filter((r) => r.is_active !== true).length;
    const totalCount = initialRows.length;

    return (
        <div className="space-y-6">
            {/* Статистика и фильтры */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm dark:bg-emerald-950/30">
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">Активных:</span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">{activeCount}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Всего:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount}</span>
                    </div>
                    {inactiveCount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm dark:bg-amber-950/30">
                            <span className="font-medium text-amber-700 dark:text-amber-300">Неактивных:</span>
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
                            placeholder="Поиск по имени..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 sm:w-64"
                        />
                    </div>

                    <div className="flex rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'all'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Все
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('active')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'active'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Активные
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('inactive')}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                                filterStatus === 'inactive'
                                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Неактивные
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
                            ? 'Сотрудники не найдены'
                            : 'Пока нет сотрудников'}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {searchQuery || filterStatus !== 'all'
                            ? 'Попробуйте изменить параметры поиска или фильтры'
                            : 'Добавьте первого сотрудника, чтобы начать работу'}
                    </p>
                    {!searchQuery && filterStatus === 'all' && (
                        <Link
                            href="/dashboard/staff/new"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Добавить сотрудника
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRows.map((staff) => (
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
                                                {staff.branches?.name ?? 'Филиал не указан'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    {staff.is_active ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            Активен
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                            Скрыт
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                                <Link
                                    href={`/dashboard/staff/${staff.id}`}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Открыть
                                </Link>
                                <ActionButtons id={String(staff.id)} isActive={!!staff.is_active} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

