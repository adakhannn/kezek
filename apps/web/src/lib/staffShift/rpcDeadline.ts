import type { FinanceCommandClient } from './financeCommand';
/** Abort the HTTP wait; a timeout never proves that a transaction did not commit. */
export function deadlineFinanceClient(client: FinanceCommandClient, deadline: number, maxCallMs: number): FinanceCommandClient {
    return { rpc: async (name, args) => {
        const remaining = Math.min(maxCallMs, deadline - Date.now());
        if (remaining <= 0) return { data: null, error: { code: 'RPC_DEADLINE', message: 'outcome_unconfirmed: request deadline exhausted' } };
        const controller = new AbortController();
        const query = client.rpc(name, args) as ReturnType<FinanceCommandClient['rpc']> & { abortSignal?: (signal: AbortSignal) => ReturnType<FinanceCommandClient['rpc']> };
        const request = query.abortSignal ? query.abortSignal(controller.signal) : query;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.resolve(request),
                new Promise<Awaited<ReturnType<FinanceCommandClient['rpc']>>>(resolve => {
                    timer = setTimeout(() => { controller.abort(); resolve({ data: null, error: { code: 'RPC_DEADLINE', message: 'outcome_unconfirmed: request timed out; inspect persisted revision before retry' } }); }, remaining);
                }),
            ]);
        } catch (error) {
            return { data: null, error: { code: 'RPC_TRANSPORT', message: 'outcome_unconfirmed: ' + (error instanceof Error ? error.message : 'transport failed') } };
        } finally { if (timer !== undefined) clearTimeout(timer); }
    } };
}
