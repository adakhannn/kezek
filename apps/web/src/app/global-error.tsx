'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Перехват ошибок рендера в App Router и отправка в Sentry.
 * ErrorBoundary в layout по-прежнему вызывает reportErrorToMonitoring (обёртка → Sentry через window.Sentry).
 * Этот компонент ловит ошибки выше boundary и отправляет их напрямую в Sentry.
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
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
                    <h1>Произошла ошибка</h1>
                    <p>Мы уже получили уведомление и работаем над исправлением.</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                    >
                        Обновить страницу
                    </button>
                </div>
            </body>
        </html>
    );
}
