/**
 * Sentry wiring that is safe to turn on (ARCH-04), shared by the web and the mobile app (MOB-07).
 * Every event and breadcrumb is scrubbed before it leaves the process: request cookies, bodies and
 * query strings are dropped, headers follow an allow-list, URLs lose fragments and credential
 * parameters, free text loses e-mails and phones, route names lose ids. Logged warnings become
 * breadcrumbs, logged errors become events, with a per-key budget so an outage cannot flood the
 * project. No SDK import: each app passes its own SDK (@sentry/nextjs, @sentry/react-native).
 */
import { maskUrl, safeExtra, sanitizeObject, sanitizeText, toLoggable } from './log';
import type { LogSink } from './log';

type Primitive = string | number | boolean | null | undefined;

type BreadcrumbLike = {
    category?: string;
    message?: string;
    data?: { [key: string]: unknown };
};

type SpanLike = {
    description?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
};

type EventLike = {
    request?: {
        url?: string;
        headers?: Record<string, unknown>;
        cookies?: unknown;
        data?: unknown;
        query_string?: unknown;
        env?: unknown;
        [key: string]: unknown;
    };
    message?: string;
    logentry?: { message?: string; params?: unknown[] };
    exception?: { values?: Array<{ value?: string; [key: string]: unknown }> };
    fingerprint?: string[];
    tags?: Record<string, Primitive>;
    transaction?: string;
    extra?: Record<string, unknown>;
    contexts?: Record<string, Record<string, unknown> | undefined>;
    breadcrumbs?: BreadcrumbLike[];
    spans?: SpanLike[];
    user?: { id?: unknown; [key: string]: unknown };
};

export type ScrubOptions = {
    /** Server and edge: console breadcrumbs duplicate log lines and may mix requests; drop them. */
    dropConsole: boolean;
};

const PLACEHOLDER_ORIGIN = 'http://relative.invalid';
const ALLOWED_HEADERS = new Set(['user-agent', 'content-type', 'accept', 'accept-language', 'x-vercel-id']);
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const URL_KEYS = ['url', 'from', 'to'] as const;
const SPAN_URL_KEYS = ['url.full', 'http.url', 'url'] as const;
const SPAN_QUERY_KEYS = ['http.query', 'url.query', 'http.fragment', 'url.fragment'] as const;

/** A URL (absolute or relative) without fragment and with credential parameters redacted. */
export function maskLocation(value: unknown): unknown {
    if (typeof value !== 'string' || !value) return value;
    try {
        const masked = maskUrl(new URL(value, PLACEHOLDER_ORIGIN));
        return masked.startsWith(PLACEHOLDER_ORIGIN) ? masked.slice(PLACEHOLDER_ORIGIN.length) || '/' : masked;
    } catch {
        return sanitizeText(value);
    }
}

/** A route name for grouping: no query or fragment, ids replaced (one issue per route, not per entity). */
export function normalizeRoute(name: string): string {
    const path = name.split(/[?#]/)[0] ?? '';
    return sanitizeText(path.replace(UUID_RE, ':id').replace(/\/\d+(?=\/|$)/g, '/:n'));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function scrubBreadcrumb<T extends BreadcrumbLike>(crumb: T, options: ScrubOptions): T | null {
    if (options.dropConsole && crumb.category === 'console') return null;
    const out = { ...crumb };
    const writable = out as BreadcrumbLike;
    if (typeof writable.message === 'string') writable.message = sanitizeText(writable.message);
    const data = asRecord(writable.data);
    if (data) {
        const copy: Record<string, unknown> = { ...data };
        // Outgoing HTTP breadcrumbs carry the raw PostgREST query (phone=eq.%2B996…): drop it.
        delete copy['http.query'];
        delete copy['http.fragment'];
        for (const key of URL_KEYS) {
            if (key in copy) copy[key] = maskLocation(copy[key]);
        }
        writable.data = asRecord(safeExtra(copy)) ?? {};
    }
    return out;
}

function scrubSpan(span: SpanLike): SpanLike {
    const out: SpanLike = { ...span };
    if (typeof out.description === 'string') out.description = String(maskLocation(out.description));
    const data = asRecord(out.data);
    if (data) {
        const copy: Record<string, unknown> = { ...data };
        for (const key of SPAN_QUERY_KEYS) delete copy[key];
        for (const key of SPAN_URL_KEYS) {
            if (key in copy) copy[key] = maskLocation(copy[key]);
        }
        out.data = copy;
    }
    return out;
}

function pickHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const kept: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(headers)) {
        if (ALLOWED_HEADERS.has(name.toLowerCase())) kept[name] = typeof value === 'string' ? sanitizeText(value) : value;
    }
    return kept;
}

/** Removes personal data and credentials from an event in place and returns it. */
export function scrubEvent<T>(event: T, options: ScrubOptions): T {
    const target = event as EventLike;

    if (target.request) {
        const request = { ...target.request };
        delete request.cookies;
        delete request.data;
        delete request.query_string;
        delete request.env;
        if (typeof request.url === 'string') request.url = String(maskLocation(request.url));
        if (request.headers) request.headers = pickHeaders(request.headers);
        target.request = request;
    }
    if (typeof target.message === 'string') target.message = sanitizeText(target.message);
    if (target.logentry) {
        target.logentry = {
            message: typeof target.logentry.message === 'string' ? sanitizeText(target.logentry.message) : target.logentry.message,
            params: Array.isArray(target.logentry.params) ? (safeExtra(target.logentry.params) as unknown[]) : undefined,
        };
    }
    for (const value of target.exception?.values ?? []) {
        if (typeof value.value === 'string') value.value = sanitizeText(value.value);
    }
    if (Array.isArray(target.fingerprint)) {
        target.fingerprint = target.fingerprint.map((part) => (typeof part === 'string' ? sanitizeText(part) : part));
    }
    if (target.tags) {
        target.tags = Object.fromEntries(
            Object.entries(target.tags).map(([key, value]) => [key, typeof value === 'string' ? sanitizeText(value) : value]),
        );
    }
    if (typeof target.transaction === 'string') target.transaction = normalizeRoute(target.transaction);
    if (target.extra) target.extra = asRecord(safeExtra(target.extra)) ?? {};
    if (target.contexts) {
        const contexts = { ...target.contexts };
        if (contexts.log) contexts.log = asRecord(sanitizeObject(contexts.log)) ?? {};
        const nextjs = contexts.nextjs;
        if (nextjs && typeof nextjs.request_path === 'string') {
            contexts.nextjs = { ...nextjs, request_path: maskLocation(nextjs.request_path) };
        }
        target.contexts = contexts;
    }
    if (Array.isArray(target.breadcrumbs)) {
        target.breadcrumbs = target.breadcrumbs
            .map((crumb) => scrubBreadcrumb(crumb, options))
            .filter((crumb): crumb is BreadcrumbLike => crumb !== null);
    }
    if (Array.isArray(target.spans)) target.spans = target.spans.map(scrubSpan);
    if (target.user) target.user = target.user.id !== undefined ? { id: target.user.id } : {};

    return event;
}

/** beforeSend: scrubbed or not sent at all - a raw event never leaves when scrubbing fails. */
export function safeBeforeSend<T>(event: T, options: ScrubOptions): T | null {
    try {
        return scrubEvent(event, options);
    } catch {
        return null;
    }
}

type ScopeLike = {
    setTag(key: string, value: string): unknown;
    setContext(name: string, context: Record<string, unknown> | null): unknown;
    setFingerprint(fingerprint: string[]): unknown;
};

/** The part of a Sentry SDK the reporter uses; both @sentry/nextjs and @sentry/react-native fit. */
export type SentryLike = {
    isInitialized(): boolean;
    getIsolationScope(): object;
    withScope(callback: (scope: ScopeLike) => void): unknown;
    captureException(exception: unknown, hint?: { mechanism?: { handled?: boolean; type?: string } }): unknown;
    captureMessage(message: string, level?: 'error'): unknown;
    addBreadcrumb(breadcrumb: { category?: string; level?: 'warning'; message?: string; data?: Record<string, unknown> }): unknown;
    flush(timeout?: number): Promise<unknown>;
};

export type SentryReporterOptions = {
    /** Server and edge: warnings become breadcrumbs only inside a request (isolated scope). */
    server: boolean;
    /** Lets serverless flush after the response (next/server after()). */
    scheduleFlush?: (task: () => Promise<unknown>) => void;
    windowMs?: number;
    maxPerKey?: number;
};

function findError(extra: unknown): Error | null {
    if (extra instanceof Error) return extra;
    const record = asRecord(extra);
    if (!record) return null;
    for (const key of ['error', 'err', 'cause', 'reason']) {
        if (record[key] instanceof Error) return record[key] as Error;
    }
    return null;
}

function errorCodeOf(extra: unknown): string | undefined {
    const loggable = asRecord(toLoggable(extra));
    if (!loggable) return undefined;
    if (typeof loggable.errorCode === 'string') return loggable.errorCode;
    const nested = asRecord(loggable.error);
    return typeof nested?.errorCode === 'string' ? nested.errorCode : undefined;
}

function transactionNameOf(scope: unknown): string {
    const getScopeData = (scope as { getScopeData?: () => { transactionName?: string } } | null)?.getScopeData;
    if (typeof getScopeData !== 'function') return '';
    return getScopeData.call(scope).transactionName ?? '';
}

const MAX_BUDGET_KEYS = 500;

/**
 * Turns logged warnings and errors into Sentry breadcrumbs and events. An Error in the extra is
 * captured as an exception; otherwise a message grouped by scope, message and error code (or
 * route). At most `maxPerKey` events per key and window; an API 5xx is reported once per request.
 */
export function createSentryReporter(sentry: SentryLike, options: SentryReporterOptions): LogSink {
    const windowMs = options.windowMs ?? 60_000;
    const maxPerKey = options.maxPerKey ?? 5;
    const rootIsolation = sentry.getIsolationScope();
    const reportedRequests = new WeakSet<object>();
    const budget = new Map<string, { count: number; resetAt: number }>();

    return (event) => {
        if (!sentry.isInitialized()) return;

        const isolation = sentry.getIsolationScope();
        const perRequest = isolation !== rootIsolation;

        if (event.level === 'warn') {
            // Outside a request a server-side breadcrumb would attach to unrelated events.
            if (!options.server || perRequest) {
                sentry.addBreadcrumb({
                    category: event.scope,
                    level: 'warning',
                    message: event.message,
                    data: asRecord(safeExtra(event.extra)),
                });
            }
            return;
        }

        if (event.meta?.kind === 'api_response' && perRequest && reportedRequests.has(isolation)) return;

        const route = normalizeRoute(transactionNameOf(isolation));
        const key = `${event.scope}|${event.message}|${route}`;
        const now = Date.now();
        const entry = budget.get(key);
        if (entry && entry.resetAt > now) {
            if (entry.count >= maxPerKey) return;
            entry.count += 1;
        } else {
            if (budget.size >= MAX_BUDGET_KEYS) budget.clear();
            budget.set(key, { count: 1, resetAt: now + windowMs });
        }

        const errorCode = errorCodeOf(event.extra);
        sentry.withScope((scope) => {
            scope.setTag('log.scope', event.scope);
            for (const [tag, value] of Object.entries(event.meta?.tags ?? {})) scope.setTag(tag, value);
            scope.setContext('log', { message: event.message, extra: safeExtra(event.extra) as Record<string, unknown> | undefined });
            const error = findError(event.extra);
            if (error) {
                sentry.captureException(error, { mechanism: { handled: true, type: 'logger' } });
            } else {
                scope.setFingerprint([event.scope, event.message, errorCode ?? route]);
                sentry.captureMessage(`[${event.scope}] ${event.message}`, 'error');
            }
        });

        if (perRequest) reportedRequests.add(isolation);
        options.scheduleFlush?.(() => sentry.flush(2000));
    };
}
