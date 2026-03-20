import Link from 'next/link';

import { AdminBookingStatusBadge } from './AdminBadges';
import { fmtTimeBishkek } from './adminUtils';
import type { BizRow, SystemCheck, TodayBookingRow } from './adminTypes';

export function AdminBookingsTodaySection({
    t,
    label,
    holdCount: _holdCount,
    confirmedCount: _confirmedCount,
    canceledCount: _canceledCount,
    todayBookings,
    StatusBadges,
}: {
    t: (key: string, fallback: string) => string;
    label: string;
    holdCount: number;
    confirmedCount: number;
    canceledCount: number;
    todayBookings: TodayBookingRow[];
    StatusBadges: React.ReactNode;
}) {
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {t('admin.home.bookingsToday.title', 'Брони сегодня')}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label} (Asia/Bishkek)</p>
                </div>
                <div className="flex flex-wrap gap-2">{StatusBadges}</div>
            </div>

            {todayBookings.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.time', 'Время')}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.business', 'Бизнес / филиал')}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.service', 'Услуга')}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.master', 'Мастер')}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.client', 'Клиент')}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.home.bookingsToday.table.status', 'Статус')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {todayBookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {fmtTimeBishkek(booking.start_at)}–{fmtTimeBishkek(booking.end_at)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {booking.bizId ? (
                                            <Link className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${booking.bizId}`}>
                                                {booking.biz}
                                            </Link>
                                        ) : (
                                            <span>{booking.biz}</span>
                                        )}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{booking.branch}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{booking.service}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{booking.staff}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{booking.client}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <AdminBookingStatusBadge status={booking.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {t('admin.home.bookingsToday.empty', 'На сегодня броней нет')}
                    </p>
                </div>
            )}
        </section>
    );
}

export function AdminLatestBusinessesSection({
    t,
    latestBiz,
}: {
    t: (key: string, fallback: string) => string;
    latestBiz: BizRow[];
}) {
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('admin.home.latestBusinesses.title', 'Последние бизнесы')}
                </h2>
                <Link href="/admin/businesses" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                    {t('admin.home.latestBusinesses.all', 'Все')} →
                </Link>
            </div>
            {latestBiz.length > 0 ? (
                <div className="space-y-3">
                    {latestBiz.map((biz) => (
                        <Link
                            key={biz.id}
                            href={`/admin/businesses/${biz.id}`}
                            className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{biz.slug}</p>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                                    {new Date(biz.created_at).toLocaleDateString('ru-RU', {
                                        day: '2-digit',
                                        month: 'short',
                                    })}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {t('admin.home.latestBusinesses.empty', 'Пока нет бизнесов')}
                    </p>
                </div>
            )}
        </section>
    );
}

export function AdminSystemChecksSection({
    t,
    checks,
}: {
    t: (key: string, fallback: string) => string;
    checks: SystemCheck[];
}) {
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('admin.home.systemChecks.title', 'Системные проверки')}
            </h2>
            <div className="space-y-3">
                {checks.map((check, index) => (
                    <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                            check.ok
                                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                        }`}
                    >
                        <div className={`flex-shrink-0 w-3 h-3 rounded-full ${check.ok ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{check.label}</p>
                            <p className={`text-xs ${check.ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                {check.ok ? t('common.ok', 'ОК') : t('admin.home.systemChecks.checkEnv', 'Проверь .env')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function AdminQuickLinksSection({ t }: { t: (key: string, fallback: string) => string }) {
    const links = [
        { href: '/admin/businesses', icon: '🏢', label: t('admin.home.quickLinks.allBusinesses', 'Все бизнесы') },
        { href: '/admin/categories', icon: '🏷️', label: t('admin.home.quickLinks.categories', 'Категории') },
        { href: '/admin/users', icon: '👥', label: t('admin.home.quickLinks.users', 'Пользователи') },
        { href: '/', icon: '🌐', label: t('admin.home.quickLinks.publicSite', 'Публичный сайт') },
    ];

    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('admin.home.quickLinks.title', 'Быстрые ссылки')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 group"
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{link.icon}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {link.label}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
