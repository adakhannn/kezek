// apps/web/src/app/staff/layout.tsx

import StaffLayoutClient from './StaffLayoutClient';

import { ErrorDisplay } from '@/app/_components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    try {
        const { staffId } = await getStaffContext();

        return (
            <StaffLayoutClient staffId={staffId}>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </StaffLayoutClient>
        );
    } catch (e: unknown) {
        if (e instanceof Error) {
            // Для критических ошибок авторизации - показываем страницу ошибки вместо редиректа
            // Это обеспечивает лучший UX и консистентность с dashboard
            if (e.message === 'UNAUTHORIZED') {
                return <ErrorDisplay errorType="UNAUTHORIZED" context="staff" />;
            }
            if (e.message === 'NO_STAFF_RECORD' || e.message === 'NO_STAFF_ACCESS') {
                return <ErrorDisplay errorType="NO_STAFF_RECORD" context="staff" />;
            }
        }
        return <ErrorDisplay errorType="GENERAL" context="staff" errorMessage={e instanceof Error ? e.message : undefined} />;
    }
}


