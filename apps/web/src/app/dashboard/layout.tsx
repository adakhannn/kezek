// apps/web/src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';

import { DashboardLayoutClient } from './components/DashboardLayoutClient';
import { MobileSidebar } from './components/MobileSidebar';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getBizContextForManagers, BizAccessError } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    try {
        const { bizId } = await getBizContextForManagers();

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="flex">
                    <MobileSidebar bizId={bizId} />
                    <section className="flex-1 min-h-screen lg:ml-0 pt-16 lg:pt-0">
                        <ErrorBoundary>
                            {children}
                        </ErrorBoundary>
                    </section>
                </div>
            </div>
        );
    } catch (e: unknown) {
        if (e instanceof BizAccessError) {
            if (e.code === 'NOT_AUTHENTICATED') {
                redirect('/b/kezek');
            }
            if (e.code === 'NO_BIZ_ACCESS') {
                return (
                    <DashboardLayoutClient
                        errorType="NO_BIZ_ACCESS"
                        diagnostics={e.diagnostics}
                    />
                );
            }
        } else if (e instanceof Error) {
            // Fallback для старых/других ошибок по message
            if (e.message === 'UNAUTHORIZED') {
                redirect('/b/kezek');
            }
            if (e.message === 'NO_BIZ_ACCESS') {
                const diagnostics = e instanceof BizAccessError ? e.diagnostics : undefined;
                return (
                    <DashboardLayoutClient
                        errorType="NO_BIZ_ACCESS"
                        diagnostics={diagnostics}
                    />
                );
            }
        }
        return (
            <DashboardLayoutClient
                errorType="GENERAL"
                errorMessage={e instanceof Error ? e.message : undefined}
            />
        );
    }
}
