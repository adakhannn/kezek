'use client';

import { SegmentError } from '@/components/SegmentError';

// A crash in one admin page keeps the admin navigation (FE-09).
export default function AdminPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <SegmentError error={error} reset={reset} scope="AdminPage" />;
}
