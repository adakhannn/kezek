// apps/web/src/app/staff/layout.tsx
import { redirect } from 'next/navigation';

import StaffLayoutClient from './StaffLayoutClient';
import StaffLayoutError from './StaffLayoutError';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    try {
        const { staffId } = await getStaffContext();

        return <StaffLayoutClient staffId={staffId}>{children}</StaffLayoutClient>;
    } catch (e: unknown) {
        if (e instanceof Error && (e.message === 'UNAUTHORIZED' || e.message === 'NO_STAFF_ACCESS' || e.message === 'NO_STAFF_RECORD')) {
            redirect('/');
        }
        return <StaffLayoutError />;
    }
}


