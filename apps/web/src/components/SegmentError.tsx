'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';

import { ErrorDisplay } from './ErrorDisplay';

import { isRecoverableChunkError } from '@/lib/chunkLoadRecovery';
import { reportErrorToMonitoring } from '@/lib/errorMonitoring';

/**
 * Error page of one section (Next.js error.tsx, FE-09). Only the crashed section is replaced: the
 * header, footer and the section's own menu stay usable, and "retry" re-renders just this part.
 * Every crash is reported once (with the server digest when the error came from the server).
 */
export function SegmentError({
    error,
    reset,
    scope,
}: {
    error: Error & { digest?: string };
    reset: () => void;
    scope: string;
}) {
    const router = useRouter();
    useEffect(() => {
        reportErrorToMonitoring({
            scope,
            error: { name: error.name, message: error.message, stack: error.stack },
            url: typeof window !== 'undefined' ? window.location.href : null,
            timestamp: new Date().toISOString(),
            extra: error.digest ? { digest: error.digest } : undefined,
        });
    }, [error, scope]);

    const retry = () => {
        // A stale chunk after a deploy only recovers with a fresh document.
        if (isRecoverableChunkError(error)) {
            window.location.reload();
            return;
        }
        // A server render error needs fresh server data; reset() alone re-renders the failed payload.
        startTransition(() => {
            router.refresh();
            reset();
        });
    };

    return <ErrorDisplay error={error} onRetry={retry} />;
}
