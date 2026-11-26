import { runAdminBranchDetailHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/businesses/[id]/branches/[branchId] as JSON: the branch form data and its working hours. */
export async function GET(_req: Request, context: unknown) {
    return runAdminBranchDetailHttp(context);
}
