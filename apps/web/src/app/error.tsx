'use client';

import { SegmentError } from '@/components/SegmentError';

// Any page crash keeps the site header and footer (FE-09); global-error.tsx handles the root layout.
export default function AppPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <SegmentError error={error} reset={reset} scope="AppPage" />;
}
