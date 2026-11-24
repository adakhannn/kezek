import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

/**
 * The Supabase client typed with the generated schema; every factory in supabaseHelpers.ts and
 * supabaseService.ts returns it. Services take this type (or a Pick of it) instead of a
 * hand-written structural client type, so table, column and RPC names are checked at the boundary.
 */
export type DbClient = SupabaseClient<Database>;

/** Table and RPC access only; tests can pass a mock with just these methods. */
export type DbQueryClient = Pick<DbClient, 'from' | 'rpc'>;

/** Only table access. */
export type DbTableClient = Pick<DbClient, 'from'>;

/** Only RPC access. */
export type DbRpcClient = Pick<DbClient, 'rpc'>;

/** Only the auth API (session and auth.admin). */
export type DbAuthClient = Pick<DbClient, 'auth'>;

export type DbTables = Database['public']['Tables'];
export type DbRow<T extends keyof DbTables> = DbTables[T]['Row'];
export type DbInsert<T extends keyof DbTables> = DbTables[T]['Insert'];
export type DbUpdate<T extends keyof DbTables> = DbTables[T]['Update'];
export type DbFunctions = Database['public']['Functions'];
export type DbFunctionArgs<F extends keyof DbFunctions> = DbFunctions[F]['Args'];

/**
 * An explicit SQL NULL for an RPC parameter. `supabase gen types` never emits `| null` for function
 * arguments (a `DEFAULT NULL` parameter only becomes optional), so `value ?? null` does not
 * type-check although the SQL function accepts NULL. The value sent is unchanged
 * (`value ?? null`); only the type is widened, here in one place instead of a cast at every call.
 */
export function nullableArg<T>(value: T | null | undefined): T {
    return (value ?? null) as T;
}
