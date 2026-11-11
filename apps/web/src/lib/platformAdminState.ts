import type { SupabaseClient } from '@supabase/supabase-js';

/** Service-only target read; actorId must come from a verified administrator. */
export async function readPlatformAdminStates(client: Pick<SupabaseClient, 'rpc'>, actorId: string, targetIds: string[]) {
    const ids = [...new Set(targetIds)];
    if (!actorId || ids.length > 200) throw new Error('Не удалось проверить права пользователей');
    if (!ids.length) return new Map<string, boolean>();
    const { data, error } = await client.rpc('read_platform_admin_states', {
        p_actor_id: actorId,
        p_target_ids: ids,
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)
        || Object.keys(data).length !== ids.length
        || ids.some(id => typeof data[id] !== 'boolean')) {
        throw new Error('Не удалось проверить права пользователей');
    }
    return new Map(ids.map(id => [id, data[id] === true]));
}
