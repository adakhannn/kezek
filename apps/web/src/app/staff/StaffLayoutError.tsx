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
                <span dangerouslySetInnerHTML={{ 
                    __html: t('staff.layout.noAccess.desc', 'У вашей учётной записи нет роли <code>staff</code> ни в одном бизнесе.')
                }} />
            </p>
            <div className="mt-4">
                <Link className="underline" href="/">
                    {t('staff.layout.noAccess.goHome', 'Перейти на главную')}
                </Link>
            </div>
        </main>
    );
}

