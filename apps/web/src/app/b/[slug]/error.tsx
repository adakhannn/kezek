'use client';

import { useEffect } from 'react';

import BusinessPageState from './BusinessPageState';

import { logError } from '@/lib/log';

export default function BusinessPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        logError('BusinessPage', 'Public business page unavailable', { digest: error.digest });
    }, [error]);

    return <BusinessPageState kind="unavailable" onRetry={reset} />;
}
