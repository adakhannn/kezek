import { ProviderDeliveryError, type StoredDelivery } from './outboxTypes';

import { getResendApiKey, getWhatsAppAccessToken, getWhatsAppPhoneNumberId } from '@/lib/env';
import { resolveWhatsAppGraphApiVersion } from '@/lib/whatsAppGraphApi';

export const PROVIDER_DEADLINE_MS = 8_000;

/** Credentials are resolved at send time and never persisted in delivery payloads. */
export async function sendOutboxDelivery(eventId: string, delivery: StoredDelivery, fetchImpl: typeof fetch = fetch): Promise<string> {
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
        const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(delivery.payload), signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const retryAfter = Math.ceil(Math.min(3600, Math.max(0, Number(response.headers.get('retry-after')) || Number(body?.parameters?.retry_after) || 0)));
            if (response.status === 429 || (delivery.channel === 'email' && response.status === 409 && body?.name === 'concurrent_idempotent_requests')) {
                throw new ProviderDeliveryError('provider_rate_limited', 'retry', retryAfter);
            }
            if (response.status >= 500) throw uncertain();
            throw new ProviderDeliveryError(`provider_http_${response.status}`, 'failed');
        }
        const providerId = delivery.channel === 'email' ? body?.id : delivery.channel === 'telegram' ? (body?.ok ? body?.result?.message_id : null) : body?.messages?.[0]?.id;
        if (providerId === null || providerId === undefined || String(providerId).length === 0) throw uncertain();
        return String(providerId);
    };
    try { return await Promise.race([send(), deadline]); }
    catch (error) { throw error instanceof ProviderDeliveryError ? error : uncertain(); }
    finally { if (timer) clearTimeout(timer); }
}
