import { ProviderDeliveryError, type StoredDelivery } from './outboxTypes';

import { getExpoAccessToken, getResendApiKey, getWhatsAppAccessToken, getWhatsAppPhoneNumberId } from '@/lib/env';
import { logWarn } from '@/lib/log';
import { maskPushToken } from '@/lib/pushTokens';
import { resolveWhatsAppGraphApiVersion } from '@/lib/whatsAppGraphApi';

export const PROVIDER_DEADLINE_MS = 8_000;

export const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';

export type SendOutboxOptions = {
    /** Removes a token Expo reported as DeviceNotRegistered; a failure here is logged, not thrown. */
    removePushToken?: (token: string) => Promise<void>;
};

type ExpoPushTicket = { status?: string; id?: string; message?: string; details?: { error?: string } };

/**
 * The ticket of a one-message Expo push request. 'ok' carries the ticket id (the provider id); an
 * error ticket means Expo did not accept the message, so it is a definite failure, except a rate
 * limit, which is retried. DeviceNotRegistered also removes the token (the install is gone).
 */
function pushTicketId(body: unknown): string | null {
    const data = (body as { data?: unknown } | null)?.data;
    const ticket = (Array.isArray(data) ? data[0] : data) as ExpoPushTicket | undefined;
    if (!ticket || typeof ticket !== 'object') return null;
    if (ticket.status === 'ok') return typeof ticket.id === 'string' ? ticket.id : null;
    const error = typeof ticket.details?.error === 'string' ? ticket.details.error : '';
    if (error === 'MessageRateExceeded') throw new ProviderDeliveryError('provider_rate_limited', 'retry', 60);
    if (error === 'DeviceNotRegistered') throw new ProviderDeliveryError('push_device_not_registered', 'failed');
    if (ticket.status === 'error') {
        throw new ProviderDeliveryError(`push_${error ? error.replace(/[^A-Za-z]/g, '').slice(0, 40) : 'ticket_error'}`, 'failed');
    }
    return null;
}

async function removeGoneToken(delivery: StoredDelivery, options: SendOutboxOptions) {
    const token = typeof delivery.payload.to === 'string' ? delivery.payload.to : '';
    if (!token || !options.removePushToken) return;
    try { await options.removePushToken(token); }
    catch (error) {
        logWarn('OutboxTransport', 'Unregistered push token could not be removed', { token: maskPushToken(token), error });
    }
}

/** Credentials are resolved at send time and never persisted in delivery payloads. */
export async function sendOutboxDelivery(eventId: string, delivery: StoredDelivery, fetchImpl: typeof fetch = fetch, options: SendOutboxOptions = {}): Promise<string> {
    let url: string;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    try {
        if (delivery.channel === 'email') {
            const token = getResendApiKey()?.trim();
            if (!token) throw new Error('Missing config');
            url = 'https://api.resend.com/emails';
            headers.Authorization = `Bearer ${token}`;
            // Resend supports this immutable payload/key replay for 24 hours.
            // SQL stops uncertain retries at 23 hours, retaining a safety margin.
            headers['Idempotency-Key'] = `booking/${eventId}/${delivery.delivery_key}`;
        } else if (delivery.channel === 'telegram') {
            const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
            if (!token) throw new Error('Missing config');
            url = `https://api.telegram.org/bot${token}/sendMessage`;
        } else if (delivery.channel === 'push') {
            // Expo needs no credentials unless the project turned on enhanced push security; then
            // EXPO_ACCESS_TOKEN is sent as a Bearer token.
            const token = getExpoAccessToken()?.trim();
            if (token) headers.Authorization = `Bearer ${token}`;
            headers.Accept = 'application/json';
            url = EXPO_PUSH_SEND_URL;
        } else {
            const token = getWhatsAppAccessToken()?.trim();
            const phoneNumberId = getWhatsAppPhoneNumberId()?.trim();
            if (!token || !phoneNumberId) throw new Error('Missing config');
            headers.Authorization = `Bearer ${token}`;
            url = `https://graph.facebook.com/${resolveWhatsAppGraphApiVersion(process.env.WHATSAPP_GRAPH_API_VERSION)}/${phoneNumberId}/messages`;
        }
    } catch {
        throw new ProviderDeliveryError('provider_config_missing', 'retry');
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const uncertain = () => new ProviderDeliveryError('provider_outcome_unknown', delivery.channel === 'email' ? 'retry' : 'ambiguous');
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(uncertain()); }, PROVIDER_DEADLINE_MS);
    });
    const send = async () => {
        // Expo takes a list of messages; a list of one always answers with a list of one ticket.
        const payload = delivery.channel === 'push' ? [delivery.payload] : delivery.payload;
        const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const retryAfter = Math.ceil(Math.min(3600, Math.max(0, Number(response.headers.get('retry-after')) || Number(body?.parameters?.retry_after) || 0)));
            if (response.status === 429 || (delivery.channel === 'email' && response.status === 409 && body?.name === 'concurrent_idempotent_requests')) {
                throw new ProviderDeliveryError('provider_rate_limited', 'retry', retryAfter);
            }
            if (response.status >= 500) throw uncertain();
            throw new ProviderDeliveryError(`provider_http_${response.status}`, 'failed');
        }
        const providerId = delivery.channel === 'email' ? body?.id
            : delivery.channel === 'telegram' ? (body?.ok ? body?.result?.message_id : null)
            : delivery.channel === 'push' ? pushTicketId(body)
            : body?.messages?.[0]?.id;
        if (providerId === null || providerId === undefined || String(providerId).length === 0) throw uncertain();
        return String(providerId);
    };
    try { return await Promise.race([send(), deadline]); }
    catch (error) {
        const failure = error instanceof ProviderDeliveryError ? error : uncertain();
        if (timer) clearTimeout(timer);
        // Outside the provider deadline: the outcome is already known, the DB call has its own.
        if (failure.code === 'push_device_not_registered') await removeGoneToken(delivery, options);
        throw failure;
    }
    finally { if (timer) clearTimeout(timer); }
}
