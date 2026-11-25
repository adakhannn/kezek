import type { Metadata } from 'next';

// apps/web/src/app/staff/layout.tsx

import { StaffBusinessChooser } from './StaffBusinessChooser';
import StaffLayoutClient from './StaffLayoutClient';

import { ErrorDisplay, type ErrorDisplayProps } from '@/app/_components/ErrorDisplay';
import { getT } from '@/app/_components/i18n/server';
import { BusinessTimeZoneProvider } from '@/components/BusinessTimeZoneContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStaffContext, BizAccessError, StaffSelectionRequiredError } from '@/lib/authBiz';
import { loadBusinessTimeZone } from '@/lib/businessTimeZone';
import type { StaffOptionLabel } from '@/lib/staffSelection';
import { loadStaffOptionLabels } from '@/lib/staffSelectionLabels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: t('staff.meta.title', 'Kezek — кабинет сотрудника') };
}

type LayoutState =
    | { staffId: string; staffOptions: StaffOptionLabel[]; timeZone: string }
    | { chooser: StaffOptionLabel[] }
    | { error: ErrorDisplayProps };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    let result: LayoutState;
    try {
        const { staffId, bizId, staffOptions } = await getStaffContext();
        // A master of several businesses gets a switcher; one card needs no names (ARCH-02).
        const [labels, timeZone] = await Promise.all([
            staffOptions.length > 1 ? loadStaffOptionLabels(staffOptions) : Promise.resolve([]),
            loadBusinessTimeZone(bizId),
        ]);
        result = { staffId, staffOptions: labels, timeZone };
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
            <BusinessTimeZoneProvider timeZone={result.timeZone}>
                <ErrorBoundary>{children}</ErrorBoundary>
            </BusinessTimeZoneProvider>
        </StaffLayoutClient>
    );
}
