import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardHomeData } from '@/lib/dashboardHomeData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The numbers of the business dashboard home (/dashboard) for the current business, as JSON. */
export async function GET() {
    return withErrorHandler('DashboardOverview', async () => {
        const data = await loadDashboardHomeData(await getBizContextForManagers());
        // A failed count is unknown, not zero (FE-08); the client shows its own load error.
        if (!data) return createErrorResponse('internal', undefined, undefined, 500);
        return createSuccessResponse(data);
    });
}
