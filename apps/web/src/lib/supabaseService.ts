import { createClient } from '@supabase/supabase-js';

import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

import type { Database } from '@/types/supabase';

export type ServiceClientOptions = {
    /** Deadline for every HTTP request the client makes; background workers set one. */
    timeoutMs?: number;
};

function fetchWithDeadline(timeoutMs: number): typeof fetch {
    return (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
}

/**
 * The only way to create a Supabase client with the service role key. The key bypasses RLS,
 * so use it only in server code (route handlers, server components, server actions, cron);
 * getSupabaseServiceRoleKey throws in the browser and when the key is not configured.
 * The client keeps no session of its own.
 */
export function getServiceClient(options: ServiceClientOptions = {}) {
    return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(options.timeoutMs ? { global: { fetch: fetchWithDeadline(options.timeoutMs) } } : {}),
    });
}
