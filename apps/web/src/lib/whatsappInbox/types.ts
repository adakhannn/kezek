export type InboxCommand = 'confirm' | 'cancel' | 'remind' | 'help' | 'booking_info' | 'media';
export type IncomingInboxMessage = {
    receiver: string;
    message_id: string;
    sender: string;
    provider_timestamp: string;
    message_type: string;
    text: string;
    command: InboxCommand;
    booking_number: number | null;
    payload_hash: string;
};
export type InboxLease = { id: string; lease_token: string; attempts: number };
export type InboxReply = { outcome: string; payload: Record<string, unknown> };
export interface WhatsAppInboxStore {
    receive(receiver: string, messages: IncomingInboxMessage[]): Promise<void>;
    claim(receiver: string, limit: number): Promise<InboxLease[]>;
    process(event: InboxLease, receiver: string): Promise<InboxReply>;
    begin(event: InboxLease): Promise<void>;
    receipt(event: InboxLease, providerId: string): Promise<void>;
    fail(event: InboxLease, outcome: 'retry' | 'failed' | 'ambiguous', code: string, retryAfter?: number): Promise<void>;
    release(event: InboxLease): Promise<void>;
    prune(): Promise<number>;
}
