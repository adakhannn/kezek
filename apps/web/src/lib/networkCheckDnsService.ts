/**
 * GET /api/network-check/dns (R25-31): resolves the one fixed Supabase host of this deployment from the
 * server. A browser cannot resolve names itself, so the network check page shows this answer next to
 * its own probes: these are the addresses the public DNS (as seen from Vercel) gives for the host, to
 * compare with the blocked addresses recorded in R25-31. It says nothing about what the visitor's
 * network resolver answers. No input of the request is used; only addresses and timing are returned.
 */
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from './apiErrorHandler';
import { getSupabaseUrl } from './env';

export const DNS_RESOLVE_TIMEOUT_MS = 2500;
export const DNS_LOOKUP_FAILED_MESSAGE = 'Сервер сайта не смог найти адрес базы данных.';

export type NetworkCheckDnsData = { host: string; ipv4: string[]; ipv6: string[]; ms: number };

type DnsResolver = Pick<Resolver, 'resolve4' | 'resolve6'>;

/** The host comes from the server's Supabase URL env only. */
export function networkCheckSupabaseHost(): string {
    return new URL(getSupabaseUrl()).hostname;
}

function errorCode(reason: unknown): string {
    const code = (reason as { code?: unknown } | null)?.code;
    return typeof code === 'string' && /^[A-Z_]{1,32}$/.test(code) ? code : 'UNKNOWN';
}

export async function resolveNetworkCheckHost(
    createResolver: () => DnsResolver = () => new Resolver({ timeout: DNS_RESOLVE_TIMEOUT_MS, tries: 1 }),
    now: () => number = () => performance.now(),
): Promise<NextResponse> {
    let host: string;
    try {
        host = networkCheckSupabaseHost();
    } catch {
        return createErrorResponse('dns_failed', DNS_LOOKUP_FAILED_MESSAGE, { code: 'CONFIG' }, 502);
    }
    const started = now();
    // A local stack (e2e) is an IP literal: nothing to resolve.
    if (isIP(host.replace(/^\[|\]$/g, ''))) {
        const literal = host.replace(/^\[|\]$/g, '');
        return createSuccessResponse<NetworkCheckDnsData>({ host, ipv4: isIP(literal) === 4 ? [literal] : [],
            ipv6: isIP(literal) === 6 ? [literal] : [], ms: 0 });
    }
    const resolver = createResolver();
    const [v4, v6] = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const ms = Math.round(now() - started);
    const ipv4 = v4.status === 'fulfilled' ? v4.value.filter((ip) => isIP(ip) === 4) : [];
    const ipv6 = v6.status === 'fulfilled' ? v6.value.filter((ip) => isIP(ip) === 6) : [];
    if (!ipv4.length && !ipv6.length) {
        // Only the resolver's error code (e.g. ENOTFOUND, ETIMEOUT), never its message.
        const code = errorCode(v4.status === 'rejected' ? v4.reason : v6.status === 'rejected' ? v6.reason : null);
        return createErrorResponse('dns_failed', DNS_LOOKUP_FAILED_MESSAGE, { code, ms }, 502);
    }
    return createSuccessResponse<NetworkCheckDnsData>({ host, ipv4, ipv6, ms });
}

/** Responses of this endpoint must never be cached by the browser or the CDN. */
export function withNoStore(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, max-age=0');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
