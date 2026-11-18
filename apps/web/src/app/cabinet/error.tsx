'use client';

import { SegmentError } from '@/components/SegmentError';

// A crash in the client cabinet keeps its navigation (FE-09).
export default function CabinetPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <SegmentError error={error} reset={reset} scope="CabinetPage" />;
}
