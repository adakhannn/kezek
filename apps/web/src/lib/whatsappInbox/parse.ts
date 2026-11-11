import { createHash } from 'node:crypto';

import type { InboxCommand, IncomingInboxMessage } from './types';

export class InvalidWhatsAppPayload extends Error {}
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidWhatsAppPayload();
    return value as Record<string, unknown>;
};
const list = (value: unknown, maximum: number): unknown[] => {
    if (!Array.isArray(value) || value.length > maximum) throw new InvalidWhatsAppPayload();
    return value;
};
const text = (value: unknown, maximum: number): string => {
    if (typeof value !== 'string' || value.length > maximum) throw new InvalidWhatsAppPayload();
    return value;
};

/** Exact command grammar: prose containing “да”/“ок” must not mutate a booking. */
export function parseInboxCommand(value: string): { command: InboxCommand; booking_number: number | null } {
    const normalized = value.trim().toLowerCase();
    const cancel = /^(?:отмена|отменить(?:\s+(?:бронь|запись))?|cancel)(?:\s+(\d{1,6}))?$/.exec(normalized);
    const confirm = /^(?:подтвердить|подтверди|подтверждаю|confirm|да|ок|ok)(?:\s+(\d{1,6}))?$/.exec(normalized);
    const match = cancel || confirm;
    if (match) return { command: cancel ? 'cancel' : 'confirm', booking_number: match[1] === undefined ? null : Number(match[1]) };
    if (/^(?:напомни(?: мне)?|remind|мои записи|мои брони)$/.test(normalized)) return { command: 'remind', booking_number: null };
    if (/^(?:помощь|help|команды|commands|что можно|\?)$/.test(normalized)) return { command: 'help', booking_number: null };
    return { command: 'booking_info', booking_number: null };
}

/** The hash includes all command inputs, including the original signed timestamp. */
export function parseWhatsAppInboxBody(body: unknown, receiver: string): IncomingInboxMessage[] {
    if (!/^\d{1,32}$/.test(receiver)) throw new InvalidWhatsAppPayload();
    const root = object(body);
    if (root.object !== 'whatsapp_business_account') throw new InvalidWhatsAppPayload();
    const messages: IncomingInboxMessage[] = [];
    for (const entry of list(root.entry, 100)) {
        for (const change of list(object(entry).changes, 100)) {
            const value = object(object(change).value);
            const metadata = object(value.metadata);
            if (metadata.phone_number_id !== receiver) throw new InvalidWhatsAppPayload();
            // Delivery status callbacks do not authorize commands or prove an uncertain send failed.
            if (value.statuses !== undefined) list(value.statuses, 100);
            for (const raw of value.messages === undefined ? [] : list(value.messages, 100)) {
                const message = object(raw);
                const id = text(message.id, 512);
                const from = text(message.from, 16);
                const timestamp = text(message.timestamp, 12);
                const messageType = text(message.type, 32);
                if (!id || !/^\d{7,15}$/.test(from) || !/^\d{1,12}$/.test(timestamp) || !/^[a-z_]+$/.test(messageType)) throw new InvalidWhatsAppPayload();
                const seconds = Number(timestamp);
                if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 253402300799) throw new InvalidWhatsAppPayload();
                const bodyText = messageType === 'text' ? text(object(message.text).body, 4096) : '';
                const command = messageType === 'text' ? parseInboxCommand(bodyText) : { command: 'media' as const, booking_number: null };
                const normalized = { receiver, message_id: id, sender: `+${from}`, provider_timestamp: new Date(seconds * 1000).toISOString(), message_type: messageType, text: bodyText, ...command };
                messages.push({ ...normalized, payload_hash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex') });
                if (messages.length > 100) throw new InvalidWhatsAppPayload();
            }
        }
    }
    return messages;
}
