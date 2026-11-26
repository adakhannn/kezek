import { runAdminBranchListHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/businesses/[id]/branches as JSON: the business with its branch limit and branches. */
export async function GET(_req: Request, context: unknown) {
    return runAdminBranchListHttp(context);
}
