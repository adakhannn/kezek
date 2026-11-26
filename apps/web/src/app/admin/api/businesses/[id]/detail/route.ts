import { runAdminBusinessDetailHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/businesses/[id] as JSON: the business, its counts, owner and active categories. */
export async function GET(_req: Request, context: unknown) {
    return runAdminBusinessDetailHttp(context);
}
