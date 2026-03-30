import { logError } from '@/lib/log';

type FieldChange = { field: string; old_value: number | null; new_value: number | null };

export type AuditLogEntry = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    field_changes: FieldChange[];
    message: string | null;
};

type AuditRow = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    field_changes: FieldChange[] | null;
    message: string | null;
};

export type StaffFinanceAuditAdminLike = {
    from: (table: 'finance_settings_audit_log' | 'profiles') => {
        select: (query: string) => {
            eq: (column: string, value: unknown) => any;
            order: (column: string, options: { ascending: boolean }) => any;
            limit: (value: number) => PromiseLike<{
                data: unknown[] | null;
                error: { message: string } | null;
            }>;
            in: (column: string, values: string[]) => PromiseLike<{
                data: Array<{ id: string; full_name: string | null }> | null;
                error: { message: string } | null;
            }>;
        };
    };
};

const MAX_ENTRIES = 100;

export async function loadStaffFinanceAuditLog(params: {
    admin: StaffFinanceAuditAdminLike;
    bizId: string | number;
    staffId: string;
}): Promise<
    | { ok: true; entries: AuditLogEntry[] }
    | { ok: false; error: 'internal'; message: string; status: 500 }
> {
    const { admin, bizId, staffId } = params;

    const auditQuery = admin
        .from('finance_settings_audit_log')
        .select('id, changed_at, changed_by_user_id, field_changes, message')
        .eq('staff_id', staffId)
        .eq('biz_id', bizId)
        .order('changed_at', { ascending: false });

    const { data: rows, error } = await auditQuery.limit(MAX_ENTRIES);

    if (error) {
        logError('FinanceAuditLog', 'Error fetching audit log', {
            error: error.message,
            staffId,
        });
        return {
            ok: false,
            error: 'internal',
            message: error.message,
            status: 500,
        };
    }

    const userIds = [
        ...new Set(
            ((rows ?? []) as AuditRow[])
                .map((row: AuditRow) => row.changed_by_user_id)
                .filter(Boolean),
        ),
    ] as string[];

    let namesByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
        const profilesQuery = admin
            .from('profiles')
            .select('id, full_name');

        const { data: profiles } = await profilesQuery.in('id', userIds);

        namesByUserId = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
            if (profile.full_name) {
                acc[profile.id] = profile.full_name;
            }
            return acc;
        }, {});
    }

    const entries: AuditLogEntry[] = ((rows ?? []) as AuditRow[]).map((row: AuditRow) => {
        const uid = row.changed_by_user_id ? String(row.changed_by_user_id) : null;
        return {
            id: String(row.id),
            changed_at: String(row.changed_at),
            changed_by_user_id: uid,
            changed_by_name: uid ? namesByUserId[uid] ?? null : null,
            field_changes: row.field_changes ?? [],
            message: row.message != null ? String(row.message) : null,
        };
    });

    return {
        ok: true,
        entries,
    };
}
