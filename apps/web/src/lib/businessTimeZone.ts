import { resolveBusinessTimeZone } from '@shared-client/timezone';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

type BusinessTzReader = Pick<SupabaseClient, 'from'>;

/**
 * The time zone of business `bizId` (`businesses.tz`, ARCH-11), Asia/Bishkek when NULL, unknown or
 * unreadable. Callers pass a business the caller is already authorized for: this reads one column.
 */
export async function loadBusinessTimeZone(bizId: string, client?: BusinessTzReader): Promise<string> {
    try {
        const db = client ?? (getServiceClient() as unknown as BusinessTzReader);
        const { data, error } = await db.from('businesses').select('tz').eq('id', bizId).maybeSingle<{ tz: string | null }>();
        if (error) logWarn('BusinessTimeZone', 'Failed to read business time zone, using the default', { bizId, error: error.message });
        return resolveBusinessTimeZone(data?.tz);
    } catch (error) {
        logWarn('BusinessTimeZone', 'Failed to read business time zone, using the default', {
            bizId,
            error: error instanceof Error ? error.message : String(error),
        });
        return resolveBusinessTimeZone(null);
    }
}
