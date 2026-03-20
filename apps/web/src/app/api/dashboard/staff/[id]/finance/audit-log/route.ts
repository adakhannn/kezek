// apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts
// Журнал изменений финансовых настроек сотрудника (audit-trail). Доступен менеджерам/владельцам.

import { ensureFinanceAuditLogAccess } from './financeAuditLogAccess';
import { loadFinanceAuditLogRows } from './financeAuditLogData';
import { buildFinanceAuditLogEntries } from './financeAuditLogResponse';

import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FieldChange = { field: string; old_value: number | null; new_value: number | null };

export type AuditLogEntry = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    field_changes: FieldChange[];
    message: string | null;
};

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('FinanceAuditLog', async () => {
        const staffId = await getRouteParamUuid(context, 'id');

        return withManagerContext(req, 'FinanceAuditLog', async ({ admin, bizId }) => {
            const access = await ensureFinanceAuditLogAccess(admin, staffId, bizId);
            if (access instanceof Response) {
                return access;
            }

            const data = await loadFinanceAuditLogRows(admin, bizId, access.staffId);
            if (data instanceof Response) {
                return data;
            }

            const entries = buildFinanceAuditLogEntries(data.rows, data.namesByUserId);
            return createSuccessResponse({ entries });
        });
    });
}
