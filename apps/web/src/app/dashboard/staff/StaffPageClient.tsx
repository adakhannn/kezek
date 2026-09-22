'use client';

import Link from 'next/link';

import FlashBanner from './FlashBanner';
import StaffListClient from './StaffListClient';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Row = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    branches: { name: string } | null;
};

export default function StaffPageClient({
    initialRows,
    showDismissed,
    bizName,
    bizCity,
    staffApplications,
}: {
    initialRows: Row[];
    showDismissed?: boolean;
    bizName?: string | null;
    bizCity?: string | null;
    staffApplications?: import('@/lib/staffApplicationSummary').StaffApplicationSummary;
}) {
    const { t } = useLanguage();

    const displayBizName = bizName || t('finance.biz.defaultName', 'Ваш бизнес в Kezek');

    return (
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8 space-y-6">
            {/* Заголовок и кнопка добавления */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        {t('staff.title', 'Сотрудники')}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t('staff.subtitle', 'Управление сотрудниками и их услугами')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('staff.biz.context', 'Бизнес')}: {displayBizName}
                        {bizCity ? ` · ${bizCity}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/staff/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('staff.addStaff', 'Добавить сотрудника')}
                    </Link>
                </div>
            </div>

            <FlashBanner showInitially={showDismissed ?? false} text={t('staff.dismissed', 'Сотрудник уволен.')} />

            {staffApplications && (
                <Link href="/dashboard/role-applications"
                    className="flex min-h-16 flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 transition hover:bg-indigo-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="font-semibold text-[var(--text-primary)]">
                            {t('dashboard.applications.title', 'Заявки сотрудников')}
                            {staffApplications.pending != null && staffApplications.pending > 0 && (
                                <span className="ml-2 inline-flex min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-sm text-white">{staffApplications.pending}</span>
                            )}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {staffApplications.pending === null
                                ? t('dashboard.applications.unavailable', 'Не удалось загрузить количество. Откройте список заявок.')
                                : staffApplications.pending > 0
                                    ? t('dashboard.applications.pending', 'Ожидают вашего решения. Рассмотрите заявки и выберите филиал для новых сотрудников.')
                                    : t('dashboard.applications.empty', 'Новых заявок нет. История рассмотрения доступна здесь.')}
                        </p>
                    </div>
                    <span className="shrink-0 font-semibold text-indigo-500">{t('dashboard.applications.open', 'Открыть заявки')} →</span>
                </Link>
            )}
            <StaffListClient initialRows={initialRows} />
        </main>
    );
}

