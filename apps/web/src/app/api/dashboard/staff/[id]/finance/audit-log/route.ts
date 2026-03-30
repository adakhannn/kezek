import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffFinanceAuditLogHttp } from '@/lib/staffFinanceAuditLogHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('FinanceAuditLog', async () =>
        runStaffFinanceAuditLogHttp(req, context),
    );
}
