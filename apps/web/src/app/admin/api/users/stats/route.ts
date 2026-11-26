import { runAdminUserStatsHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The /admin/users counters (total, active, blocked, super admins) over the whole directory. */
export async function GET() {
    return runAdminUserStatsHttp();
}
