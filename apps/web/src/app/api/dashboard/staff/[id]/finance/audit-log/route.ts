// apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts
// Журнал изменений финансовых настроек сотрудника (audit-trail). Доступен менеджерам/владельцам.

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ENTRIES = 100;

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
        return withManagerAndStaffContext<{ id: string; biz_id: string | number | null }>(
            req,
            context,
            { scope: 'FinanceAuditLog', staffIdParamName: 'id', staffSelect: 'id, biz_id' },
            async ({ admin, bizId, staffId }) => {

        const { data: rows, error } = await admin
            .from('finance_settings_audit_log')
            .select('id, changed_at, changed_by_user_id, field_changes, message')
            .eq('staff_id', staffId)
            .eq('biz_id', bizId)
            .order('changed_at', { ascending: false })
            .limit(MAX_ENTRIES);

        if (error) {
            logError('FinanceAuditLog', 'Error fetching audit log', { error: error.message, staffId });
            return createErrorResponse('internal', error.message, undefined, 500);
        }

        const userIds = [...new Set((rows ?? []).map((r: { changed_by_user_id?: string | null }) => r.changed_by_user_id).filter(Boolean))] as string[];
        let namesByUserId: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', userIds);
            namesByUserId = (profiles ?? []).reduce<Record<string, string>>((acc, p) => {
                if (p.full_name) acc[p.id] = p.full_name;
                return acc;
            }, {});
        }

        type AuditRow = {
            id: string;
            changed_at: string;
            changed_by_user_id: string | null;
            field_changes: FieldChange[] | null;
            message: string | null;
        };

        const entries: AuditLogEntry[] = (rows ?? []).map((row) => {
            const r = row as AuditRow;
            const uid = r.changed_by_user_id ? String(r.changed_by_user_id) : null;
            return {
                id: String(r.id),
                changed_at: String(r.changed_at),
                changed_by_user_id: uid,
                changed_by_name: uid ? namesByUserId[uid] ?? null : null,
                field_changes: r.field_changes ?? [],
                message: r.message != null ? String(r.message) : null,
            };
        });

        return createSuccessResponse({ entries });
        },
        );
    });
}
