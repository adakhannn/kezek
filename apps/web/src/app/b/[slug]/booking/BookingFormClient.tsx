'use client';

import dynamic from 'next/dynamic';
import type { ComponentType, JSX } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type BookingFormProps = {
    data: unknown;
};

const BookingForm = dynamic(() => import('../view')) as ComponentType<BookingFormProps>;

export function BookingFormClient(props: BookingFormProps): JSX.Element {
    const { t } = useLanguage();

    return (
        <ErrorBoundary
            fallback={
                <div className="flex min-h-screen items-center justify-center px-4 [background:var(--surface-canvas)]">
                    <div className="w-full max-w-xl rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--shadow-lg)]">
                        <p className="type-label text-[var(--status-danger)]">
                            {t('booking.error.badge', 'Поток записи временно недоступен')}
                        </p>
                        <h1 className="type-page-title mt-3 [color:var(--text-primary)]">
                            {t('booking.error.title', 'Ошибка при загрузке формы бронирования')}
                        </h1>
                        <p className="type-body mt-3 [color:var(--text-secondary)]">
                            {t('booking.error.message', 'Произошла ошибка при отображении формы бронирования. Попробуйте обновить страницу.')}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-md)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)]"
                        >
                            {t('booking.error.reload', 'Обновить страницу')}
                        </button>
                    </div>
                </div>
            }
        >
            <BookingForm {...props} />
        </ErrorBoundary>
    );
}
