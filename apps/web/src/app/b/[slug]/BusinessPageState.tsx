'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';

type BusinessPageStateProps = {
    kind: 'not-found' | 'unavailable';
    onRetry?: () => void;
};

export default function BusinessPageState({ kind, onRetry }: BusinessPageStateProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const [isOffline, setIsOffline] = useState(false);
    const wasOffline = useRef(false);

    const retry = useCallback(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            wasOffline.current = true;
            setIsOffline(true);
            return;
        }

        if (onRetry) onRetry();
        else router.refresh();
    }, [onRetry, router]);

    useEffect(() => {
        const syncNetworkState = () => {
            const offline = !navigator.onLine;
            setIsOffline(offline);

            if (offline) {
                wasOffline.current = true;
                return;
            }

            if (wasOffline.current) {
                wasOffline.current = false;
                if (onRetry) onRetry();
                else router.refresh();
            }
        };

        syncNetworkState();
        window.addEventListener('offline', syncNetworkState);
        window.addEventListener('online', syncNetworkState);

        return () => {
            window.removeEventListener('offline', syncNetworkState);
            window.removeEventListener('online', syncNetworkState);
        };
    }, [onRetry, router]);

    const unavailable = kind === 'unavailable' || isOffline;
    const title = unavailable ? t('business.unavailable.title') : t('business.notFound.title');
    const description = unavailable
        ? t('business.unavailable.description')
        : t('business.notFound.description');

    return (
        <main className="mx-auto flex min-h-[60vh] w-full max-w-[var(--container-lg)] items-center justify-center px-4 py-10">
            <div
                className="w-full max-w-xl rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--shadow-md)]"
                role={unavailable ? 'alert' : undefined}
            >
                <h1 className="type-page-title text-[var(--text-primary)]">{title}</h1>
                <p className="type-body mt-3 text-[var(--text-secondary)]">{description}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button type="button" onClick={retry}>
                        {t('business.unavailable.retry')}
                    </Button>
                    <Link
                        href="/"
                        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-emphasis)]"
                    >
                        {t('business.unavailable.catalog')}
                    </Link>
                </div>
            </div>
        </main>
    );
}
