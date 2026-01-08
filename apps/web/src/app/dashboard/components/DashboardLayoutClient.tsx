'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type DashboardLayoutClientProps = {
    errorType: 'NO_BIZ_ACCESS' | 'GENERAL';
    errorMessage?: string;
};

export function DashboardLayoutClient({ errorType, errorMessage }: DashboardLayoutClientProps) {
    const { t } = useLanguage();

    if (errorType === 'NO_BIZ_ACCESS') {
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2">{t('dashboard.error.noAccess', 'Нет доступа к кабинету')}</h1>
                <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: t('dashboard.error.noAccessDesc', 'У вашей учётной записи нет ролей <code>owner / admin / manager</code> ни в одном бизнесе.') }} />
                <div className="mt-4">
                    <Link className="underline" href="/b/kezek">{t('dashboard.error.goToPublic', 'Перейти на публичную витрину')}</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="p-6">
            <h1 className="text-xl font-semibold mb-2 text-red-600">{t('dashboard.error.general', 'Ошибка')}</h1>
            <p className="text-sm text-gray-600">
                {t('dashboard.error.generalDesc', 'Произошла ошибка при загрузке кабинета. Пожалуйста, попробуйте обновить страницу.')}
            </p>
            {errorMessage && (
                <p className="text-xs text-gray-500 mt-2">
                    {t('dashboard.error.details', 'Детали:')} {errorMessage}
                </p>
            )}
            <div className="mt-4">
                <Link className="underline" href="/b/kezek">{t('dashboard.error.goToPublic', 'Перейти на публичную витрину')}</Link>
            </div>
        </main>
    );
}

