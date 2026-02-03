'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type ErrorDisplayProps = {
    error: Error;
    onRetry?: () => void;
    title?: string;
    showDetails?: boolean;
};

/**
 * Компонент для отображения ошибок в веб-приложении
 */
export function ErrorDisplay({ 
    error, 
    onRetry, 
    title,
    showDetails = process.env.NODE_ENV === 'development'
}: ErrorDisplayProps) {
    const { t } = useLanguage();
    
    const isEnvError = error.message.includes('environment variables') || 
                      error.message.includes('NEXT_PUBLIC') ||
                      error.message.includes('Missing required environment variable');
    
    const isNetworkError = error.message.includes('fetch') || 
                          error.message.includes('network') ||
                          error.message.includes('NetworkError');

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
                    {/* Иконка */}
                    <div className="flex justify-center mb-6">
                        <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                        </div>
                    </div>

                    {/* Заголовок */}
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
                        {title || t('error.title', 'Что-то пошло не так')}
                    </h1>

                    {/* Сообщение об ошибке */}
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                        {error.message || t('error.message', 'Произошла непредвиденная ошибка')}
                    </p>

                    {/* Детали ошибки (только в dev режиме) */}
                    {showDetails && error.stack && (
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {t('error.details', 'Детали ошибки (только в режиме разработки):')}
                            </p>
                            <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono overflow-auto max-h-48">
                                {error.stack}
                            </pre>
                        </div>
                    )}

                    {/* Помощь для ошибок окружения */}
                    {isEnvError && (
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                {t('error.env.title', 'Проверьте настройки:')}
                            </p>
                            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                                <li>{t('error.env.step1', 'Создайте файл .env.local в корне проекта')}</li>
                                <li>{t('error.env.step2', 'Добавьте необходимые переменные окружения')}</li>
                                <li>{t('error.env.step3', 'Перезапустите сервер разработки')}</li>
                            </ul>
                        </div>
                    )}

                    {/* Помощь для сетевых ошибок */}
                    {isNetworkError && (
                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                                {t('error.network.title', 'Проблема с подключением:')}
                            </p>
                            <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1 list-disc list-inside">
                                <li>{t('error.network.step1', 'Проверьте подключение к интернету')}</li>
                                <li>{t('error.network.step2', 'Убедитесь, что сервер доступен')}</li>
                                <li>{t('error.network.step3', 'Попробуйте обновить страницу')}</li>
                            </ul>
                        </div>
                    )}

                    {/* Действия */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('error.retry', 'Попробовать снова')}
                            </button>
                        )}
                        <Link
                            href="/"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            {t('error.home', 'На главную')}
                        </Link>
                    </div>
                </div>

                {/* Дополнительная информация */}
                <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('error.help', 'Если проблема сохраняется, пожалуйста, свяжитесь с поддержкой')}
                </p>
            </div>
        </div>
    );
}

