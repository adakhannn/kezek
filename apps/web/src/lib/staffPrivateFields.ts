import type { SupabaseClient } from '@supabase/supabase-js';

/** Fields of a staff member that are closed to other sessions (20261117170000). */
export type StaffPrivateFields = {
    id: string;
    biz_id: string;
    branch_id: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    user_id: string | null;
    avatar_url: string | null;
    is_active: boolean;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
    rating_score: number | null;
};

export type StaffPrivateFieldsResult =
    | { data: StaffPrivateFields | null; error: null }
    | { data: null; error: { code?: string; message: string } };

/**
 * Контакты, привязка аккаунта и условия оплаты сотрудника читаются только через
 * staff_private_fields(): её пускают сам сотрудник, руководство его бизнеса, платформенный
 * админ и service role. Чужой сессии функция отвечает ошибкой 42501, несуществующему id — null.
 */
export async function readStaffPrivateFields(
    client: Pick<SupabaseClient, 'rpc'>,
    staffId: string,
): Promise<StaffPrivateFieldsResult> {
    const { data, error } = await client.rpc('staff_private_fields', { p_staff_id: staffId });
    if (error) {
        return { data: null, error: { code: error.code, message: error.message } };
    }
    const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    return { data: row as StaffPrivateFields | null, error: null };
}
