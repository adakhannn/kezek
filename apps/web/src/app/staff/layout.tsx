// apps/web/src/app/staff/layout.tsx

import StaffLayoutClient from './StaffLayoutClient';

import { ErrorDisplay, type ErrorDisplayProps } from '@/app/_components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStaffContext, BizAccessError } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    let result: { staffId: string } | { error: ErrorDisplayProps };
    try {
        const { staffId } = await getStaffContext();
        result = { staffId };
    } catch (e: unknown) {
        const code = e instanceof BizAccessError ? e.code : e instanceof Error ? e.message : null;
        if ((e instanceof BizAccessError && code === 'NOT_AUTHENTICATED') || code === 'UNAUTHORIZED') {
            result = { error: { errorType: 'UNAUTHORIZED' } };
        } else if (code === 'NO_STAFF_RECORD' || code === 'NO_STAFF_ACCESS') {
            result = { error: { errorType: 'NO_STAFF_RECORD' } };
        } else {
            result = { error: { errorType: 'GENERAL', errorMessage: e instanceof Error ? e.message : undefined } };
        }
    }
    if ('error' in result) return <ErrorDisplay {...result.error} context="staff" />;
    return (
        <StaffLayoutClient staffId={result.staffId}>
            <ErrorBoundary>{children}</ErrorBoundary>
        </StaffLayoutClient>
    );
}
