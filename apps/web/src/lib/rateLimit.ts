import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { NextResponse } from 'next/server';

import { logWarn } from './log';

export type RateLimitConfig = {
    maxRequests: number;
    windowMs: number;
    /** Only a verified server-side identity may override the ingress identifier. */
    identifier?: string;
    /** Optional bounded sub-action, in addition to the mandatory route template. */
    keyPrefix?: string;
};
export type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
    unavailable?: boolean;
};
export const RATE_LIMIT_TIMEOUT_MS = 1000;
export const RATE_LIMIT_MEMORY_CAP = 10000;

// One atomic operation repairs orphan counters and never refreshes a live window.
// Multiple verified principal/tenant budgets are charged in the same EVAL request.
export const RATE_LIMIT_SCRIPT = `
local result = {}
local blocked = false
for i, key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET', key) or '0')
  local ttl = redis.call('PTTL', key)
  if ttl == -1 then
    redis.call('PEXPIRE', key, ARGV[i])
    ttl = tonumber(ARGV[i])
  end
  if count >= tonumber(ARGV[#KEYS + i]) then blocked = true end
  result[#result + 1] = count + 1
  result[#result + 1] = ttl < 0 and tonumber(ARGV[i]) or ttl
end
-- An exhausted user's retries must not spend the shared tenant allowance.
if blocked then return result end
result = {}
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  local ttl = redis.call('PTTL', key)
  if count == 1 or ttl < 0 then
    redis.call('PEXPIRE', key, ARGV[i])
    ttl = tonumber(ARGV[i])
  end
  result[#result + 1] = count
  result[#result + 1] = ttl
end
return result
`;

const memory = new Map<string, { count: number; resetAt: number }>();
type Budget = { key: string; maxRequests: number; windowMs: number };

/** Compatibility for mobile auth attempt fingerprints only, not a trusted rate-limit identity. */
export function getRateLimitIdentifier(req: Request): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

/** The operator must also ensure the ingress removes/overwrites client-supplied values. */
export function getTrustedRateLimitIdentifier(req: Request): string | undefined {
    const header = process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
    if (!header) return process.env.NODE_ENV === 'production' ? undefined : 'development-local';
    if (!['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-vercel-forwarded-for'].includes(header)) return undefined;
    const value = req.headers.get(header)?.trim();
    // An arbitrary proxy chain is not evidence of the client address. Require a single,
    // validated address written by the configured ingress, not first-value guessing.
    return value && isIP(value) ? value : undefined;
}

function validConfig(config: RateLimitConfig): boolean {
    return Number.isSafeInteger(config.maxRequests) && config.maxRequests > 0
        && Number.isSafeInteger(config.windowMs) && config.windowMs > 0 && config.windowMs <= 86400000;
}
function budgetFor(req: Request, routeId: string, config: RateLimitConfig, identity: string, scope = 'ingress'): Budget {
    if (!routeId || !routeId.startsWith('/') || routeId.includes('?') || !validConfig(config)) {
        throw new Error('Invalid rate-limit configuration');
    }
    const digest = createHash('sha256').update(JSON.stringify([scope, identity])).digest('hex');
    return { key: `ratelimit:v2:${req.method.toUpperCase()}:${routeId}:${config.keyPrefix ?? ''}:${digest}`,
        maxRequests: config.maxRequests, windowMs: config.windowMs };
}
function unavailable(config: Pick<RateLimitConfig, 'maxRequests'>): RateLimitResult {
    return { success: false, unavailable: true, limit: config.maxRequests, remaining: 0,
        reset: Date.now() + 1000, retryAfter: 1 };
}
function resultFor(count: number, ttl: number, budget: Budget, now: number): RateLimitResult {
    return { success: count <= budget.maxRequests, limit: budget.maxRequests,
        remaining: Math.max(0, budget.maxRequests - count), reset: now + ttl,
        ...(count > budget.maxRequests ? { retryAfter: Math.max(1, Math.ceil(ttl / 1000)) } : {}) };
}
function memoryBudgets(budgets: Budget[]): RateLimitResult[] {
    const now = Date.now();
    if (memory.size + budgets.length > RATE_LIMIT_MEMORY_CAP) {
        for (const [key, entry] of memory) if (entry.resetAt <= now) memory.delete(key);
        const missing = budgets.filter(budget => !memory.has(budget.key)).length;
        // Evicting an active counter would let key churn bypass the limit.
        if (memory.size + missing > RATE_LIMIT_MEMORY_CAP) return budgets.map(unavailable);
    }
    if (budgets.some(budget => {
        const entry = memory.get(budget.key);
        return entry && entry.resetAt > now && entry.count >= budget.maxRequests;
    })) {
        return budgets.map(budget => {
            const entry = memory.get(budget.key);
            return resultFor(entry && entry.resetAt > now ? entry.count + 1 : 1,
                entry && entry.resetAt > now ? entry.resetAt - now : budget.windowMs, budget, now);
        });
    }
    return budgets.map(budget => {
        let entry = memory.get(budget.key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + budget.windowMs };
            memory.set(budget.key, entry);
        }
        entry.count++;
        return resultFor(entry.count, entry.resetAt - now, budget, now);
    });
}
async function consumeBudgets(budgets: Budget[]): Promise<RateLimitResult[]> {
    const { getUpstashRedisUrl, getUpstashRedisToken } = await import('./env');
    const url = getUpstashRedisUrl();
    const token = getUpstashRedisToken();
    if (!url || !token) {
        return process.env.NODE_ENV === 'production' || !!url || !!token
            ? budgets.map(unavailable) : memoryBudgets(budgets);
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const operation = (async () => {
            const { Redis } = await import('@upstash/redis');
            const redis = new Redis({ url, token, retry: false, enableAutoPipelining: false,
                enableTelemetry: false, signal: controller.signal });
            return redis.eval<number[], unknown>(RATE_LIMIT_SCRIPT, budgets.map(budget => budget.key),
                [...budgets.map(budget => budget.windowMs), ...budgets.map(budget => budget.maxRequests)]);
        })();
        const deadline = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Rate-limit deadline exceeded')); }, RATE_LIMIT_TIMEOUT_MS);
        });
        const raw = await Promise.race([operation, deadline]);
        if (!Array.isArray(raw) || raw.length !== budgets.length * 2) throw new Error('Invalid limiter response');
        const now = Date.now();
        return budgets.map((budget, index) => {
            const count: unknown = raw[index * 2];
            const ttl: unknown = raw[index * 2 + 1];
            if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1
                || typeof ttl !== 'number' || !Number.isSafeInteger(ttl) || ttl < 0 || ttl > budget.windowMs) {
                throw new Error('Invalid limiter counter or expiry');
            }
            return resultFor(count, ttl, budget, now);
        });
    } catch {
        // Do not log credentials, raw client identifiers or provider response bodies.
        logWarn('RateLimit', 'Shared limiter unavailable; request denied');
        return budgets.map(unavailable);
    } finally { if (timer) clearTimeout(timer); }
}
function combine(results: RateLimitResult[]): RateLimitResult {
    return results.find(result => result.unavailable) ?? results.find(result => !result.success) ?? results[0];
}

export async function checkRateLimit(req: Request, config: RateLimitConfig, routeId: string): Promise<RateLimitResult> {
    try {
        const identifier = config.identifier ?? getTrustedRateLimitIdentifier(req);
        if (!identifier) return unavailable(config);
        return combine(await consumeBudgets([budgetFor(req, routeId, config, identifier,
            config.identifier ? 'verified-identifier' : 'ingress')]));
    } catch { return unavailable(config); }
}

/** Call only after authentication and tenant authorization; never pass decoded JWT claims. */
export async function checkVerifiedPrincipalRateLimit(req: Request, routeId: string,
    principal: { userId: string; bizId: string }, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!principal.userId || !principal.bizId) return unavailable(config);
    try {
        return combine(await consumeBudgets([
            budgetFor(req, routeId, config, `${principal.bizId}:${principal.userId}`, 'principal'),
            budgetFor(req, routeId, { ...config, maxRequests: config.maxRequests * 60 }, principal.bizId, 'tenant'),
        ]));
    } catch { return unavailable(config); }
}

export function rateLimitDeniedResponse(result: RateLimitResult): NextResponse {
    return new NextResponse(JSON.stringify({ ok: false,
        error: result.unavailable ? 'service_unavailable' : 'rate_limit_exceeded',
        message: result.unavailable ? 'Проверка лимитов временно недоступна. Повторите позже.'
            : `Превышен лимит запросов. Попробуйте через ${result.retryAfter} секунд.`,
        retryAfter: result.retryAfter,
    }), { status: result.unavailable ? 503 : 429, headers: {
        'Content-Type': 'application/json', 'Retry-After': String(result.retryAfter ?? 1),
        'X-RateLimit-Limit': String(result.limit), 'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
    } });
}

export async function withRateLimit(req: Request, config: RateLimitConfig,
    handler: () => Promise<Response>, routeId: string): Promise<Response> {
    const result = await checkRateLimit(req, config, routeId);
    if (!result.success) return rateLimitDeniedResponse(result);
    const response = await handler();
    const headers = new Headers(response.headers);
    // A narrower authenticated budget inside the handler takes precedence.
    if (!headers.has('X-RateLimit-Limit')) {
        headers.set('X-RateLimit-Limit', String(result.limit));
        headers.set('X-RateLimit-Remaining', String(result.remaining));
        headers.set('X-RateLimit-Reset', String(result.reset));
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const RateLimitConfigs = {
    public: { maxRequests: 10, windowMs: 60000 },
    critical: { maxRequests: 5, windowMs: 60000 },
    normal: { maxRequests: 30, windowMs: 60000 },
    auth: { maxRequests: 5, windowMs: 15 * 60000 },
    // Shared NAT admission for authenticated mutations; principal budgets remain 5/30.
    authenticatedIngress: { maxRequests: 600, windowMs: 60000 },
} as const;

export function routeRateLimit(routeId: string, baseConfig: RateLimitConfig, overrides?: Partial<RateLimitConfig>): RateLimitConfig {
    return { ...baseConfig, ...overrides, keyPrefix: routeId };
}
