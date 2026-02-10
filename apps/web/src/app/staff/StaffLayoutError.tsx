'use client';

import { ErrorDisplay } from '@/app/_components/ErrorDisplay';

export default function StaffLayoutError() {
    return <ErrorDisplay errorType="GENERAL" context="staff" />;
}

