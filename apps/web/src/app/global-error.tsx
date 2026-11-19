'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import { LanguageProvider, useLanguage } from './_components/i18n/LanguageProvider';

/**
 * Перехват ошибок рендера в App Router и отправка в Sentry.
 * ErrorBoundary в layout по-прежнему вызывает reportErrorToMonitoring (logError → репортёр мониторинга → Sentry при заданном DSN).
 * Этот компонент ловит ошибки выше boundary и отправляет их напрямую в Sentry.
 * Он заменяет корневой layout, поэтому LanguageProvider подключается здесь заново: язык берётся
 * из cookie и браузера, как во всём приложении (русский словарь всегда в бандле).
 */
export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            Sentry.captureException(error);
        }
    }, [error]);

    return (
        <html lang="ru">
            <body>
                <LanguageProvider>
                    <GlobalErrorContent />
                </LanguageProvider>
            </body>
        </html>
    );
}

function GlobalErrorContent() {
    const { t } = useLanguage();

    return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
            <h1>{t('error.general.title', 'Произошла ошибка')}</h1>
            <p>{t('common.globalError.description', 'Мы уже получили уведомление и работаем над исправлением.')}</p>
            <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
                {t('error.action.reload', 'Обновить страницу')}
            </button>
        </div>
    );
}
