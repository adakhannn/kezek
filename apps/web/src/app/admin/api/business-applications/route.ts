import { runAdminBusinessApplicationsHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/business-applications as JSON: the 200 newest applications and active category names. */
export async function GET() {
    return runAdminBusinessApplicationsHttp();
}
