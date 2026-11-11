import type { ReportClient } from '@/lib/finance/reportSnapshot';

export type StaffHistoryRow = { id: string; shift_date: string; status: string; total_amount: number; master_share: number;
    salon_share: number; late_minutes: number; guaranteed_amount: number; topup_amount: number };
/** One staff member, caller RLS, one consistent JSON result; never stop at a REST page cap. */
export async function readStaffHistory(client: ReportClient, bizId: string, staffId: string, dateFrom?: string, dateTo?: string): Promise<StaffHistoryRow[]> {
    const { data, error } = await client.rpc('read_staff_finance_history', { p_biz_id: bizId, p_staff_id: staffId,
        p_date_from: dateFrom ?? null, p_date_to: dateTo ?? null });
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Incomplete staff finance history');
    for (const row of data) {
        if (!row || typeof row.shift_date !== 'string' || !['open', 'closed'].includes(row.status)) throw new Error('Invalid staff finance history');
        for (const field of ['total_amount', 'master_share', 'salon_share', 'late_minutes', 'guaranteed_amount', 'topup_amount']) {
            if (row[field] !== null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]))) throw new Error('Invalid staff finance amount');
        }
    }
    return data as StaffHistoryRow[];
}
