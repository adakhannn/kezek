import { parseFrontendMetric, type FrontendMetric } from '@/lib/performanceCore';

/** Best effort and untrusted by the collector; never exports URLs or identities. */
export async function sendFrontendMetric(metric: FrontendMetric): Promise<void> {
    if (typeof window === 'undefined' || !parseFrontendMetric(metric)) return;
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    const payload = JSON.stringify(metric);
    try {
        if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/metrics/frontend', new Blob([payload], { type: 'application/json' }))) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const request = fetch('/api/metrics/frontend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true, signal: controller.signal });
            const deadline = new Promise<void>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(); }, 500); });
            await Promise.race([request, deadline]);
        } finally { if (timer) clearTimeout(timer); }
    } catch { /* No retry or UI disruption for optional browser telemetry. */ }
}
