'use client';

import dynamic from 'next/dynamic';
import type { ReactElement, ComponentType } from 'react';

import { ErrorBanner } from '@/app/_components/ErrorBanner';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type BookingsClientProps = {
    bizId: string;
    businessTz?: string | null;
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
                    <div className="w-full max-w-xl">
                        <ErrorBanner
                            variant="internal"
                            title={t('bookings.error.title', 'Ошибка при загрузке броней')}
                            message={t(
                                'bookings.error.message',
                                'Произошла ошибка при отображении броней. Попробуйте обновить страницу.',
                            )}
                            onRetry={() => window.location.reload()}
                        />
                    </div>
                </div>
            }
        >
            <BookingsClient {...props} />
        </ErrorBoundary>
    );
}


