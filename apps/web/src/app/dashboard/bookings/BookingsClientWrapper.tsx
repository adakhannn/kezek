'use client';

import dynamic from 'next/dynamic';
import type { ReactElement, ComponentType } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type BookingsClientProps = {
    bizId: string;
    services: unknown[];
    staff: unknown[];
    branches: unknown[];
    initial: unknown[];
};

// Используем dynamic без жёсткой проверки типов модуля и приводим к ожидаемым пропсам
const BookingsClient = dynamic(() => import('./view')) as ComponentType<BookingsClientProps>;

export function BookingsClientWrapper(props: BookingsClientProps): ReactElement {
    const { t } = useLanguage();
    
    return (
        <ErrorBoundary
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {t('bookings.error.title', 'Ошибка при загрузке броней')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            {t('bookings.error.message', 'Произошла ошибка при отображении броней. Попробуйте обновить страницу.')}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                        >
                            {t('bookings.error.reload', 'Обновить страницу')}
                        </button>
                    </div>
                </div>
            }
        >
            <BookingsClient {...props} />
        </ErrorBoundary>
    );
}


