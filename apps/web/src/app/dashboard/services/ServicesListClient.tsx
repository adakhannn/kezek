'use client';

import Link from 'next/link';

import DeleteServiceButton from './DeleteServiceButton';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Branch = { id: string; name: string };

type GroupedService = {
    name_ru: string;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_ids: string[];
    first_id: string;
};

export default function ServicesListClient({
    list,
    branches,
    branchFilter,
}: {
    list: GroupedService[];
    branches: Branch[];
    branchFilter: string;
}) {
    const { t, locale } = useLanguage();

    const formatNumber = (n: number) =>
        n.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');

    return (
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                            {t('services.title', 'Услуги')}
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            {t('services.subtitle', 'Управление услугами бизнеса')}
                        </p>
                    </div>
                    <Link
                        href="/dashboard/services/new"
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('services.addService', 'Добавить услугу')}
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                        {t('services.filter.branch', 'Филиал:')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            className={`text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                                branchFilter
                                    ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                            }`}
                            href="/dashboard/services"
                        >
                            {t('services.filter.allBranches', 'Все')}
                        </Link>
                        {branches.map((b) => (
                            <Link
                                key={b.id}
                                className={`text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                                    branchFilter === b.id
                                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                                href={`/dashboard/services?branch=${b.id}`}
                            >
                                {b.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile: Cards View */}
            <div className="md:hidden space-y-3">
                {list.map((s) => {
                    const branchNames = s.branch_ids
                        .map((bid) => branches.find((b) => b.id === bid)?.name)
                        .filter(Boolean)
                        .join(', ');

                    return (
                        <div
                            key={s.first_id}
                            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">
                                    {s.name_ru}
                                </h3>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                        s.active
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                    }`}
                                >
                                    {s.active
                                        ? t('services.status.active', 'активна')
                                        : t('services.status.hidden', 'скрыта')}
                                </span>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {t('services.table.duration', 'Длительность')}:
                                    </span>
                                    <span>
                                        {s.duration_min} {locale === 'en' ? 'min' : 'мин'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {t('services.table.price', 'Цена')}:
                                    </span>
                                    <span>
                                        {formatNumber(s.price_from)}–{formatNumber(s.price_to)}{' '}
                                        {t('booking.currency', 'сом')}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                                        {t('services.table.branches', 'Филиал')}:
                                    </span>
                                    <span className="break-words">
                                        {branchNames || '—'}
                                        {s.branch_ids.length > 1 && (
                                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                                ({s.branch_ids.length})
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <Link
                                    href={`/dashboard/services/${s.first_id}`}
                                    className="flex-1 px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-center"
                                >
                                    {t('common.editShort', 'Редакт.')}
                                </Link>
                                <div className="flex-1">
                                    <DeleteServiceButton id={s.first_id} />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {list.length === 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center text-gray-500 dark:text-gray-400">
                        {t('services.empty', 'Нет услуг')}
                    </div>
                )}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('services.table.name', 'Название')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('services.table.duration', 'Длительность')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('services.table.price', 'Цена')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('services.table.branches', 'Филиал')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('services.table.status', 'Статус')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-40">
                                    {t('services.table.actions', 'Действия')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {list.map((s) => {
                                const branchNames = s.branch_ids
                                    .map((bid) => branches.find((b) => b.id === bid)?.name)
                                    .filter(Boolean)
                                    .join(', ');

                                return (
                                    <tr
                                        key={s.first_id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {s.name_ru}
                                        </td>
                                        <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                            {s.duration_min}{' '}
                                            {locale === 'en' ? 'min' : 'мин'}
                                        </td>
                                        <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                            {formatNumber(s.price_from)}–{formatNumber(s.price_to)}{' '}
                                            {t('booking.currency', 'сом')}
                                        </td>
                                        <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                            {branchNames || '—'}
                                            {s.branch_ids.length > 1 && (
                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                    ({s.branch_ids.length})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    s.active
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                }`}
                                            >
                                                {s.active
                                                    ? t('services.status.active', 'активна')
                                                    : t('services.status.hidden', 'скрыта')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/dashboard/services/${s.first_id}`}
                                                    className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                                                >
                                                    {t('common.editShort', 'Редакт.')}
                                                </Link>
                                                <DeleteServiceButton id={s.first_id} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {list.length === 0 && (
                                <tr>
                                    <td
                                        className="p-8 text-center text-gray-500 dark:text-gray-400"
                                        colSpan={6}
                                    >
                                        {t('services.empty', 'Нет услуг')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


