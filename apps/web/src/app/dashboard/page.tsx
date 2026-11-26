import { DashboardHomeClient } from './components/DashboardHomeClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardHomeData } from '@/lib/dashboardHomeData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DashboardHome() {
    const context = await getBizContextForManagers();
    // The mobile app reads the same numbers from GET /api/dashboard/overview.
    const data = await loadDashboardHomeData(context);
    if (!data) {
        return <LoadFailedNotice page />;
    }

    return (
        <DashboardHomeClient
            staffApplications={data.staffApplications}
            bizName={data.bizName}
            bizCity={data.bizCity}
            formattedDate={data.formattedDate}
            bookingsToday={data.bookingsToday}
            staffActive={data.staffActive}
            servicesActive={data.servicesActive}
            branchesCount={data.branchesCount}
            needOnboarding={data.needOnboarding}
            ratingScore={data.ratingScore}
            ratingConfigScope={data.ratingConfigScope}
            ratingWeights={data.ratingWeights}
        />
    );
}
