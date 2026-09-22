'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export function RoleApplicationsHeader() {
    const { t } = useLanguage();
    return (
        <header className="min-w-0 space-y-3">
            <Link href="/dashboard/staff"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] transition hover:text-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
                <span aria-hidden="true">←</span>
                {t('dashboard.applications.backToStaff', 'К сотрудникам')}
            </Link>
            <div>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                    {t('dashboard.applications.title', 'Заявки сотрудников')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                    {t('dashboard.applications.description', 'Рассмотрите заявку и выберите филиал при принятии. Рабочая карточка сотрудника и базовое расписание создадутся автоматически.')}
                </p>
            </div>
        </header>
    );
}
