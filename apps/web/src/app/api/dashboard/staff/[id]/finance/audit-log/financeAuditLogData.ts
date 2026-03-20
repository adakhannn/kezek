import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';

const MAX_ENTRIES = 100;

type FieldChange = { field: string; old_value: number | null; new_value: number | null };

export type FinanceAuditLogRow = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    field_changes: FieldChange[] | null;
    message: string | null;
};

type FinanceAuditLogProfileRow = {
    id: string;
    full_name: string | null;
};

type QueryBuilder = {
    select: (columns: string) => QueryBuilder;
    eq: (column: string, value: unknown) => QueryBuilder;
    order: (column: string, options: { ascending: boolean }) => QueryBuilder;
    limit: (count: number) => Promise<{ data: unknown; error?: { message: string } | null }>;
    in: (column: string, values: string[]) => Promise<{ data: unknown; error?: { message: string } | null }>;
};

type AdminLikeClient = {
    from: (table: string) => QueryBuilder;
};

export async function loadFinanceAuditLogRows(
    admin: AdminLikeClient,
    bizId: string,
    staffId: string
): Promise<{ rows: FinanceAuditLogRow[]; namesByUserId: Record<string, string> } | Response> {
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

    const normalizedRows = Array.isArray(rows) ? (rows as FinanceAuditLogRow[]) : [];
    const userIds = [...new Set(normalizedRows.map((row) => row.changed_by_user_id).filter(Boolean))] as string[];

    let namesByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await admin
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

        namesByUserId = (Array.isArray(profiles) ? (profiles as FinanceAuditLogProfileRow[]) : []).reduce<Record<string, string>>(
            (acc, profile) => {
                if (profile.full_name) {
                    acc[profile.id] = profile.full_name;
                }
                return acc;
            },
            {}
        );
    }

    return {
        rows: normalizedRows,
        namesByUserId,
    };
}
