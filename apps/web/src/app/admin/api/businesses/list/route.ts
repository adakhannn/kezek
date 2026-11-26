import { runAdminBusinessListHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/businesses as JSON: every business with its owner's name and branch/staff counts. */
export async function GET() {
    return runAdminBusinessListHttp();
}
