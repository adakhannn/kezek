import type { FinanceAuditLogRow } from './financeAuditLogData';
import type { AuditLogEntry } from './route';

export function buildFinanceAuditLogEntries(
    rows: FinanceAuditLogRow[],
    namesByUserId: Record<string, string>
): AuditLogEntry[] {
    return rows.map((row) => {
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
}
