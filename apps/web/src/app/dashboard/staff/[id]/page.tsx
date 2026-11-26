import { isUuid } from '@shared-client/validation';
import { notFound } from 'next/navigation';

import StaffDetailPageClient from './StaffDetailPageClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardStaffDetail } from '@/lib/dashboardStaffReadService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { supabase, bizId, userId } = await getBizContextForManagers();

    // Staff card, branches, reviews and rating config; the same read serves
    // GET /api/dashboard/staff/[id] (the mobile app).
    const detail = await loadDashboardStaffDetail({ supabase, bizId, userId }, id);
    if (!detail.ok) {
        return detail.reason === 'not_found' ? notFound() : <LoadFailedNotice page />;
    }

    return (
        <StaffDetailPageClient
            explicitScheduling={detail.data.explicitScheduling}
            staff={detail.data.staff}
            branches={detail.data.branches}
            reviews={detail.data.reviews}
            ratingScore={detail.data.ratingScore}
            ratingWeights={detail.data.ratingWeights}
        />
    );
}
