import type { SupabaseClient } from '@supabase/supabase-js';

import type { InboxLease, InboxReply, WhatsAppInboxStore } from './types';

export class WhatsAppInboxStoreError extends Error {
    constructor(readonly code: string) { super(code); this.name = 'WhatsAppInboxStoreError'; }
}
const row = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalidResult = () => new WhatsAppInboxStoreError('INBOX_INVALID_RESULT');
export function createWhatsAppInboxStore(admin: SupabaseClient): WhatsAppInboxStore {
    const rpc = async (name: string, args: Record<string, unknown> = {}): Promise<unknown> => {
        const { data, error } = await admin.rpc(name, args).abortSignal(AbortSignal.timeout(5000));
        if (error) throw new WhatsAppInboxStoreError(
            ['INBOX_LEASE_LOST', 'INBOX_PAYLOAD_CONFLICT', 'INBOX_INVALID_INPUT'].includes(error.message) ? error.message : 'INBOX_DATABASE_FAILED');
        return data;
    };
    const identity = (event: InboxLease) => ({ p_id: event.id, p_token: event.lease_token });
    return {
        receive: async (receiver, messages) => {
            const data = await rpc('receive_whatsapp_inbox', { p_receiver: receiver, p_messages: messages });
            if (typeof data !== 'number' || !Number.isInteger(data) || data < 0 || data > messages.length) throw invalidResult();
        },
        claim: async (receiver, limit) => {
            const data = await rpc('claim_whatsapp_inbox', { p_receiver: receiver, p_limit: limit });
            if (!Array.isArray(data) || data.length > limit || !data.every(item => row(item) && uuid(item.id) && uuid(item.lease_token)
                && typeof item.attempts === 'number' && Number.isInteger(item.attempts) && item.attempts >= 1 && item.attempts <= 8)) throw invalidResult();
            return data as InboxLease[];
        },
        process: async (event, receiver) => {
            const data = await rpc('process_whatsapp_inbox', { ...identity(event), p_receiver: receiver });
            if (!row(data) || typeof data.outcome !== 'string' || !row(data.payload) || data.payload.messaging_product !== 'whatsapp'
                || typeof data.payload.to !== 'string' || !/^\d{7,15}$/.test(data.payload.to) || data.payload.type !== 'text'
                || !row(data.payload.text) || typeof data.payload.text.body !== 'string' || data.payload.text.body.length > 4096) throw invalidResult();
            return data as InboxReply;
        },
        begin: async event => { await rpc('begin_whatsapp_inbox_reply', identity(event)); },
        receipt: async (event, providerId) => { await rpc('record_whatsapp_inbox_reply', { ...identity(event), p_provider_id: providerId }); },
        fail: async (event, outcome, code, retryAfter = 0) => { await rpc('fail_whatsapp_inbox', { ...identity(event), p_outcome: outcome, p_code: code, p_retry_after: retryAfter }); },
        release: async event => { await rpc('release_whatsapp_inbox', identity(event)); },
        prune: async () => (await rpc('prune_whatsapp_inbox', { p_limit: 100 })) as number,
    };
}
