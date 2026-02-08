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
                <h1 className="text-xl font-semibold mb-2 text-red-600 dark:text-red-400">
                    {t('dashboard.error.noAccess', 'Нет доступа к кабинету')}
                </h1>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        {t('dashboard.error.noAccessDesc.prefix', 'У вашей учётной записи нет ролей')}{' '}
                        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                            owner
                        </code>
                        {' / '}
                        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                            admin
                        </code>
                        {' / '}
                        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                            manager
                        </code>
                        {' '}
                        {t('dashboard.error.noAccessDesc.suffix', 'ни в одном бизнесе.')}
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                            {t('dashboard.error.troubleshooting', 'Что делать:')}
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                            <li>{t('dashboard.error.troubleshooting.1', 'Убедитесь, что вы авторизованы под правильной учётной записью')}</li>
                            <li>{t('dashboard.error.troubleshooting.2', 'Обратитесь к владельцу бизнеса для получения доступа')}</li>
                            <li>{t('dashboard.error.troubleshooting.3', 'Проверьте, что у вас есть роль owner, admin или manager в бизнесе')}</li>
                        </ul>
                    </div>
                </div>
                <div className="mt-6 flex gap-4">
                    <Link 
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                        href="/b/kezek"
                    >
                        {t('dashboard.error.goToPublic', 'Перейти на публичную витрину')}
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t('dashboard.error.reload', 'Обновить страницу')}
                    </button>
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

