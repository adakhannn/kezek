import type { SupabaseClient } from '@supabase/supabase-js';

// Keep the SDK boundary: a handwritten recursive PostgREST interface causes
// excessive type instantiation in Next's clean production typecheck.
export type SuperAdminRoleClient = Pick<SupabaseClient, 'rpc'>;

/** Caller must pass the same user-session client whose getUser() was verified.
 * SQL derives identity from auth.uid(); no target actor is accepted by the RPC.
 */
export async function checkCurrentUserIsSuperAdmin(client: SuperAdminRoleClient, userId: string) {
    if (!userId) return { isSuperAdmin: false, error: null };
    const lookupError = { message: 'Не удалось проверить права доступа' };
    try {
        const { data, error } = await client.rpc('is_super_admin');
        if (error || typeof data !== 'boolean') return { isSuperAdmin: false, error: lookupError };
        return { isSuperAdmin: data === true, error: null };
    } catch {
        return { isSuperAdmin: false, error: lookupError };
    }
}
