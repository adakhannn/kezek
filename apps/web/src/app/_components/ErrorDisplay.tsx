/**
 * Единый компонент для отображения ошибок авторизации и доступа
 * Используется на страницах /staff и /dashboard для консистентного UX
 */

'use client';

import Link from 'next/link';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export type ErrorType = 
    | 'UNAUTHORIZED' 
    | 'NO_STAFF_RECORD' 
    | 'NO_BIZ_ACCESS' 
    | 'GENERAL';

export interface ErrorDisplayProps {
    errorType: ErrorType;
    errorMessage?: string;
    context?: 'staff' | 'dashboard';
    diagnostics?: {
        checkedSuperAdmin?: boolean;
        checkedUserRoles?: boolean;
        checkedOwnerId?: boolean;
        userRolesFound?: number;
        eligibleRolesFound?: number;
        ownedBusinessesFound?: number;
        errorsCount?: number;
    };
}

export function ErrorDisplay({ 
    errorType, 
    errorMessage, 
    context = 'staff',
    diagnostics 
}: ErrorDisplayProps) {
    const { t } = useLanguage();
    const isDev = process.env.NODE_ENV === 'development';

    // Определяем контекстные сообщения
    const getErrorConfig = () => {
        switch (errorType) {
            case 'UNAUTHORIZED':
                return {
                    title: t('error.unauthorized.title', 'Требуется авторизация'),
                    description: t('error.unauthorized.description', 'Для доступа к этой странице необходимо войти в систему.'),
                    icon: (
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    ),
                    actions: [
                        { href: '/auth/sign-in', label: t('error.unauthorized.action.signIn', 'Войти в систему') },
                        { href: '/', label: t('error.unauthorized.action.home', 'На главную') },
                    ],
                };
            
            case 'NO_STAFF_RECORD':
                return {
                    title: t('error.noStaffRecord.title', 'Нет доступа к кабинету сотрудника'),
                    description: t('error.noStaffRecord.description', 'Ваша учётная запись не связана с активным сотрудником. Обратитесь к администратору для получения доступа.'),
                    icon: (
                        <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ),
                    actions: [
                        { href: '/', label: t('error.noStaffRecord.action.home', 'На главную') },
                        { href: '/auth/sign-in', label: t('error.noStaffRecord.action.signIn', 'Войти под другой учётной записью') },
                    ],
                };
            
            case 'NO_BIZ_ACCESS':
                return {
                    title: t('error.noBizAccess.title', 'Нет доступа к кабинету управления'),
                    description: t('error.noBizAccess.description', 'Не удалось определить бизнес для вашей учётной записи. Для доступа к кабинету управления вам необходимы права менеджера, администратора или владельца бизнеса.'),
                    icon: (
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ),
                    actions: [
                        { href: '/b/kezek', label: t('error.noBizAccess.action.public', 'Перейти на публичную витрину') },
                        { href: '/auth/sign-in', label: t('error.noBizAccess.action.signIn', 'Войти под другой учётной записью') },
                    ],
                };
            
            default:
                return {
                    title: t('error.general.title', 'Произошла ошибка'),
                    description: errorMessage || t('error.general.description', 'Произошла неожиданная ошибка. Попробуйте обновить страницу или обратитесь в поддержку.'),
                    icon: (
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    actions: [
                        { href: context === 'staff' ? '/' : '/b/kezek', label: t('error.general.action.home', 'На главную') },
                        { href: '/auth/sign-in', label: t('error.general.action.signIn', 'Войти снова') },
                    ],
                };
        }
    };

    const config = getErrorConfig();

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="max-w-2xl w-full">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 p-6 md:p-8">
                    {/* Заголовок и иконка */}
                    <div className="flex items-start gap-4 mb-6">
                        <div className="flex-shrink-0">
                            {config.icon}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                                {config.title}
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {config.description}
                            </p>
                        </div>
                    </div>

                    {/* Дополнительная информация для NO_BIZ_ACCESS */}
                    {errorType === 'NO_BIZ_ACCESS' && (
                        <div className="space-y-4 mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                                    {t('error.noBizAccess.why', 'Почему это произошло?')}
                                </p>
                                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                                    {t('error.noBizAccess.whyDesc', 'Система проверила следующие способы определения вашего бизнеса:')}
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-400">
                                    <li>{t('error.noBizAccess.check.1', 'Проверка статуса супер-администратора')}</li>
                                    <li>{t('error.noBizAccess.check.2', 'Поиск ролей в таблице user_roles (owner, admin, manager)')}</li>
                                    <li>{t('error.noBizAccess.check.3', 'Проверка владения бизнесом (businesses.owner_id)')}</li>
                                </ul>
                                <p className="text-sm text-blue-800 dark:text-blue-300 mt-3">
                                    {t('error.noBizAccess.whyDesc2', 'Ни один из этих способов не вернул бизнес для вашей учётной записи.')}
                                </p>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">
                                    {t('error.noBizAccess.troubleshooting', 'Что делать:')}
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                                    <li>
                                        {t('error.noBizAccess.troubleshooting.1', 'Убедитесь, что вы авторизованы под правильной учётной записью. Выйдите и войдите снова, если необходимо.')}
                                    </li>
                                    <li>
                                        {t('error.noBizAccess.troubleshooting.2', 'Обратитесь к владельцу бизнеса или администратору системы для получения доступа. Вам необходимо:')}
                                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                            <li>
                                                {t('error.noBizAccess.troubleshooting.2a', 'Получить роль')}{' '}
                                                <code className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs font-mono">
                                                    owner
                                                </code>
                                                {', '}
                                                <code className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs font-mono">
                                                    admin
                                                </code>
                                                {' или '}
                                                <code className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs font-mono">
                                                    manager
                                                </code>
                                                {' '}
                                                {t('error.noBizAccess.troubleshooting.2b', 'в таблице user_roles')}
                                            </li>
                                            <li>
                                                {t('error.noBizAccess.troubleshooting.2c', 'Или стать владельцем бизнеса (установить businesses.owner_id = ваш user.id)')}
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t('error.noBizAccess.troubleshooting.3', 'Если вы уверены, что должны иметь доступ, проверьте логи сервера для диагностики проблемы.')}
                                    </li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {/* Дополнительная информация для NO_STAFF_RECORD */}
                    {errorType === 'NO_STAFF_RECORD' && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                            <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">
                                {t('error.noStaffRecord.troubleshooting', 'Что делать:')}
                            </p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                                <li>
                                    {t('error.noStaffRecord.troubleshooting.1', 'Убедитесь, что вы авторизованы под правильной учётной записью.')}
                                </li>
                                <li>
                                    {t('error.noStaffRecord.troubleshooting.2', 'Обратитесь к администратору вашего бизнеса для создания записи сотрудника.')}
                                </li>
                                <li>
                                    {t('error.noStaffRecord.troubleshooting.3', 'Убедитесь, что ваша учётная запись связана с активным сотрудником в системе.')}
                                </li>
                            </ol>
                        </div>
                    )}

                    {/* Диагностическая информация (только в dev режиме) */}
                    {isDev && diagnostics && (
                        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                            <p className="font-semibold mb-2">
                                {t('error.diagnostics', 'Диагностическая информация (только для разработчиков)')}
                            </p>
                            <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(diagnostics, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Действия */}
                    <div className="flex flex-wrap gap-3 mt-6">
                        {config.actions.map((action, index) => (
                            <Link
                                key={index}
                                href={action.href}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {action.label}
                            </Link>
                        ))}
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t('error.action.reload', 'Обновить страницу')}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}

