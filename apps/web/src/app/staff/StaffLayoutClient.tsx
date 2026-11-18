'use client';

import { StaffMobileSidebar } from './components/StaffMobileSidebar';
import { StaffSelectionProvider } from './staffSelectionContext';

import type { StaffOptionLabel } from '@/lib/staffSelection';

export default function StaffLayoutClient({
    staffId,
    staffOptions = [],
    children,
}: {
    staffId: string;
    staffOptions?: StaffOptionLabel[];
    children: React.ReactNode;
}) {
    return (
        <StaffSelectionProvider staffId={staffId}>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="flex items-start">
                    <StaffMobileSidebar staffId={staffId} staffOptions={staffOptions} />
                    <section className="min-h-screen min-w-0 flex-1 pb-24 pt-4 md:pb-0 lg:pt-0">{children}</section>
                </div>
            </div>
        </StaffSelectionProvider>
    );
}
