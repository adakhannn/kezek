'use client';

import { StaffMobileSidebar } from './components/StaffMobileSidebar';

export default function StaffLayoutClient({ staffId, children }: { staffId: string; children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="flex">
                <StaffMobileSidebar staffId={staffId} />
                <section className="flex-1 min-h-screen lg:ml-0">{children}</section>
            </div>
        </div>
    );
}

