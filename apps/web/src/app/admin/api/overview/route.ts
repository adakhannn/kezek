import { runAdminOverviewHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The /admin home as JSON: platform counts, newest businesses, today's bookings, system checks. */
export async function GET() {
    return runAdminOverviewHttp();
}
