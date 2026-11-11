// Test-only persistence port for the real async attempt service. Never returns
// a production client, and deliberately rejects unknown tables/query methods.
type Row = Record<string, unknown>;
type Result = { data: Row | Row[] | null; error: { message: string } | null };

const rows = new Map<string, Row>();
const grants = new Map<string, Row>();

function query() {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row = {};
    let singular = false;
    let required = false;
    const filters: ((row: Row) => boolean)[] = [];
    const execute = (): Result => {
        if (operation === 'insert') {
            const nonce = String(payload.nonce);
            if (rows.has(nonce)) return { data: null, error: { message: 'duplicate nonce' } };
            rows.set(nonce, {
                created_at: new Date().toISOString(), consumed_at: null,
                telegram_id: null, user_id: null, exchange_code: null, ...payload,
            });
            return { data: null, error: null };
        }
        const matched = [...rows.values()].filter(row => filters.every(filter => filter(row)));
        if (operation === 'update') {
            // Supabase ignores undefined fields, but explicit nulls are retained.
            for (const row of matched) for (const [key, value] of Object.entries(payload)) {
                if (value !== undefined) row[key] = value;
            }
        }
        if (operation === 'delete') for (const row of matched) rows.delete(String(row.nonce));
        const result = matched.map(row => ({ ...row }));
        if (singular) return { data: result[0] ?? null, error: required && result.length !== 1 ? { message: 'row not found' } : null };
        return { data: result, error: null };
    };
    const builder = {
        select: (_columns?: string) => builder,
        insert: (value: Row) => { operation = 'insert'; payload = value; return builder; },
        update: (value: Row) => { operation = 'update'; payload = value; return builder; },
        delete: () => { operation = 'delete'; return builder; },
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return builder; },
        is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return builder; },
        gt: (key: string, value: string) => { filters.push(row => String(row[key]) > value); return builder; },
        lt: (key: string, value: string) => { filters.push(row => String(row[key]) < value); return builder; },
        single: () => { singular = true; required = true; return Promise.resolve(execute()); },
        maybeSingle: () => { singular = true; return Promise.resolve(execute()); },
        then: (resolve: (result: Result) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    };
    return builder;
}

export const telegramAttemptPersistence = {
    reset: () => { rows.clear(); grants.clear(); },
    client: {
        rpc: async (name: string, args: Record<string, string>) => {
            if (name === 'create_mobile_session_grant') {
                grants.set(args.p_code_hash, { code_challenge: args.p_code_challenge, user_id: args.p_user_id });
                return { data: null, error: null };
            }
            if (name !== 'consume_mobile_session_grant') throw new Error(`Unmocked RPC: ${name}`);
            const grant = grants.get(args.p_code_hash);
            if (!grant || grant.code_challenge !== args.p_code_challenge) return { data: null, error: null };
            grants.delete(args.p_code_hash);
            return { data: grant.user_id, error: null };
        },
        from: (table: string) => {
            if (table === 'mobile_session_grants') return { insert: async (grant: Row) => { grants.set(String(grant.code_hash), grant); return { error: null }; } };
            if (table !== 'telegram_mobile_auth_attempts') throw new Error(`Unmocked persistence table: ${table}`);
            return query();
        },
    },
};
