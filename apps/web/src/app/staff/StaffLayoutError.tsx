'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function StaffLayoutError() {
    const { t } = useLanguage();

    return (
        <main className="p-6">
            <h1 className="text-xl font-semibold mb-2">
                {t('staff.layout.noAccess.title', 'Нет доступа к кабинету сотрудника')}
            </h1>
            <p className="text-sm text-gray-600">
                {t('staff.layout.noAccess.desc.prefix', 'У вашей учётной записи нет роли')}{' '}
                <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                    staff
                </code>
                {' '}
                {t('staff.layout.noAccess.desc.suffix', 'ни в одном бизнесе.')}
            </p>
            <div className="mt-4">
                <Link className="underline" href="/">
                    {t('staff.layout.noAccess.goHome', 'Перейти на главную')}
                </Link>
            </div>
        </main>
    );
}

