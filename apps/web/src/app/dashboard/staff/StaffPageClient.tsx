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

export default function StaffPageClient({ initialRows, showDismissed }: { initialRows: Row[]; showDismissed?: boolean }) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8 space-y-6">
            {/* Заголовок и кнопка добавления */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('staff.title', 'Сотрудники')}</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t('staff.subtitle', 'Управление сотрудниками и их услугами')}
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

            <StaffListClient initialRows={initialRows} />
        </main>
    );
}

