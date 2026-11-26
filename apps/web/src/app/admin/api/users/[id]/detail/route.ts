import { runAdminUserDetailHttp } from '@/lib/adminPanelHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** /admin/users/[id] as JSON: the account, super-admin flag, businesses, roles and suspension. */
export async function GET(_req: Request, context: unknown) {
    return runAdminUserDetailHttp(context);
}
