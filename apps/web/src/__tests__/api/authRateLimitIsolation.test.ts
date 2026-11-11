jest.mock('@/lib/env', () => ({ getUpstashRedisUrl: jest.fn(), getUpstashRedisToken: jest.fn() }));
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn() }));
jest.mock('@/lib/whatsAppSendOtpHttpService', () => ({ runWhatsAppSendOtpHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/whatsAppVerifyOtpHttpService', () => ({ runWhatsAppVerifyOtpHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/telegramLinkHttpService', () => ({ runTelegramLinkHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/telegramLoginHttpService', () => ({ runTelegramLoginHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/whatsAppAuthSendOtpHttpService', () => ({ runWhatsAppAuthSendOtpHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/whatsAppAuthVerifyOtpHttpService', () => ({ runWhatsAppAuthVerifyOtpHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/whatsAppCreateSessionHttpService', () => ({ runWhatsAppCreateSessionHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));
jest.mock('@/lib/mobileExchangeHttpService', () => ({ runMobileExchangePostHttp: jest.fn(async () => new Response('{"ok":true}', { status: 200 })) }));

import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { getUpstashRedisUrl, getUpstashRedisToken } from '@/lib/env';
import { checkRateLimit, RateLimitConfigs } from '@/lib/rateLimit';
import { POST as action0 } from '@/app/api/whatsapp/send-otp/route';
import { POST as action1 } from '@/app/api/whatsapp/verify-otp/route';
import { POST as action2 } from '@/app/api/auth/telegram/link/route';
import { POST as action3 } from '@/app/api/auth/telegram/login/route';
import { POST as action4 } from '@/app/api/auth/whatsapp/send-otp/route';
import { POST as action5 } from '@/app/api/auth/whatsapp/verify-otp/route';
import { POST as action6 } from '@/app/api/auth/whatsapp/create-session/route';
import { POST as action7 } from '@/app/api/auth/mobile-exchange/route';

let caseNumber = 0;
const previousProxyHeader = process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
afterAll(() => { if(previousProxyHeader === undefined) delete process.env.RATE_LIMIT_TRUSTED_IP_HEADER; else process.env.RATE_LIMIT_TRUSTED_IP_HEADER = previousProxyHeader; });

const actions = [
    { path: '/api/whatsapp/send-otp', post: action0 },
    { path: '/api/whatsapp/verify-otp', post: action1 },
    { path: '/api/auth/telegram/link', post: action2 },
    { path: '/api/auth/telegram/login', post: action3 },
    { path: '/api/auth/whatsapp/send-otp', post: action4 },
    { path: '/api/auth/whatsapp/verify-otp', post: action5 },
    { path: '/api/auth/whatsapp/create-session', post: action6 },
    { path: '/api/auth/mobile-exchange', post: action7 },
];

describe.each(['memory', 'redis'])('auth rate-limit isolation (%s)', (backend) => {
    beforeEach(() => {
        jest.clearAllMocks();
        caseNumber++;
        process.env.RATE_LIMIT_TRUSTED_IP_HEADER = 'x-forwarded-for';
        (getUpstashRedisUrl as jest.Mock).mockReturnValue(backend === 'redis' ? 'https://redis.example' : '');
        (getUpstashRedisToken as jest.Mock).mockReturnValue(backend === 'redis' ? 'test' : '');
        const counts = new Map<string, number>();
        (Redis as jest.Mock).mockImplementation(() => ({
            eval: jest.fn(async (_script: string, keys: string[], windows: number[]) => keys.flatMap((key, index) => {
                const count = (counts.get(key) ?? 0) + 1;
                counts.set(key, count);
                return [count, windows[index]];
            })),
        }));
    });

    test.each(actions)('$path keeps its limit without blocking other actions', async (target) => {
        const ip = `203.0.113.${caseNumber}`;
        const request = (path: string) => new NextRequest('https://example.com' + path, {
            method: 'POST', headers: { 'x-forwarded-for': ip },
        });
        // Reproduce a busy profile: unrelated requests have already used the legacy counter.
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(request('/api/metrics/frontend'), RateLimitConfigs.normal, '/api/metrics/frontend');
        }
        for (let i = 0; i < 5; i++) {
            const response = await target.post(request(target.path));
            expect(response.status).toBe(200);
            expect(response.headers.get('X-RateLimit-Remaining')).toBe(String(4 - i));
        }
        // Query strings must not let clients create a fresh counter.
        const blocked = await target.post(request(target.path + '?retry=1'));
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
        await expect(blocked.json()).resolves.toMatchObject({ error: 'rate_limit_exceeded' });

        for (const other of actions.filter((action) => action !== target)) {
            const response = await other.post(request(other.path));
            expect(response.status).toBe(200);
            expect(response.headers.get('X-RateLimit-Remaining')).toBe('4');
        }
        // A different client still has its own allowance.
        const independent = await target.post(new NextRequest('https://example.com' + target.path, {
            method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${caseNumber}` },
        }));
        expect(independent.status).toBe(200);
    });
});

