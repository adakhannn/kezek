// apps/web/src/app/staff/layout.tsx

import { StaffBusinessChooser } from './StaffBusinessChooser';
import StaffLayoutClient from './StaffLayoutClient';

import { ErrorDisplay, type ErrorDisplayProps } from '@/app/_components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStaffContext, BizAccessError, StaffSelectionRequiredError } from '@/lib/authBiz';
import type { StaffOptionLabel } from '@/lib/staffSelection';
import { loadStaffOptionLabels } from '@/lib/staffSelectionLabels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LayoutState =
    | { staffId: string; staffOptions: StaffOptionLabel[] }
    | { chooser: StaffOptionLabel[] }
    | { error: ErrorDisplayProps };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    let result: LayoutState;
    try {
        const { staffId, staffOptions } = await getStaffContext();
        // A master of several businesses gets a switcher; one card needs no names (ARCH-02).
        result = { staffId, staffOptions: staffOptions.length > 1 ? await loadStaffOptionLabels(staffOptions) : [] };
    } catch (e: unknown) {
        const code = e instanceof BizAccessError ? e.code : e instanceof Error ? e.message : null;
        if (e instanceof StaffSelectionRequiredError) {
            result = { chooser: await loadStaffOptionLabels(e.staffOptions) };
        } else if ((e instanceof BizAccessError && code === 'NOT_AUTHENTICATED') || code === 'UNAUTHORIZED') {
            result = { error: { errorType: 'UNAUTHORIZED' } };
        } else if (code === 'NO_STAFF_RECORD' || code === 'NO_STAFF_ACCESS') {
            result = { error: { errorType: 'NO_STAFF_RECORD' } };
        } else {
            result = { error: { errorType: 'GENERAL', errorMessage: e instanceof Error ? e.message : undefined } };
        }
    }
    if ('error' in result) return <ErrorDisplay {...result.error} context="staff" />;
    if ('chooser' in result) return <StaffBusinessChooser options={result.chooser} />;
    return (
        <StaffLayoutClient staffId={result.staffId} staffOptions={result.staffOptions}>
            <ErrorBoundary>{children}</ErrorBoundary>
        </StaffLayoutClient>
    );
}
