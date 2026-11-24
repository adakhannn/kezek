import type { DbClient } from '@/lib/supabaseTypes';

/**
 * Hands a partial Supabase mock to a service that takes the typed client (or a Pick of it).
 * Tests mock only the methods the service calls; the one widening cast lives here.
 */
export function asDbClient<T = DbClient>(mock: object): T {
    return mock as T;
}
