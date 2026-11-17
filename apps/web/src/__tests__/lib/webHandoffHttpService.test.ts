jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/env', () => ({ getSiteOrigin: () => 'https://kezek.vercel.app' }));
jest.mock('@/lib/verifiedIdentitySession', () => ({ issueSessionForVerifiedUser: jest.fn() }));

import { NextResponse } from 'next/server';

import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import type { WebHandoffStore } from '@/lib/webHandoff';
import { runCreateWebHandoffHttp, runRedeemWebHandoffHttp } from '@/lib/webHandoffHttpService';

function mapStore(): WebHandoffStore {
    const data = new Map<string, string>();
    return {
        put: async (key, value) => { if (data.has(key)) return false; data.set(key, value); return true; },
        take: async (key) => { const value = data.get(key) ?? null; data.delete(key); return value; },
    };
}

const post = (body: unknown = { next: '/select-business' }) => new Request('https://kezek.vercel.app/api/auth/web-handoff', {
    method: 'POST', headers: { authorization: 'Bearer app-token', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const get = (code: string) => new Request(`https://kezek.vercel.app/auth/handoff?code=${encodeURIComponent(code)}`);

beforeEach(() => {
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ user: { id: 'user-1' }, supabase: {}, authSource: 'bearer' } as never);
});

test('an app session gets a one-time URL that signs the browser in with its own session', async () => {
    const store = mapStore();
    const issueSession = jest.fn().mockResolvedValue({ accessToken: 'web-access', refreshToken: 'web-refresh' });

    const created = await runCreateWebHandoffHttp(post(), { store });
    expect(created.status).toBe(200);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const { url } = await created.json();
    const handoff = new URL(url);
    expect(`${handoff.origin}${handoff.pathname}`).toBe('https://kezek.vercel.app/auth/handoff');
    // The app's own tokens never appear in the URL it opens.
    expect(url).not.toContain('app-token');

    const redeemed = await runRedeemWebHandoffHttp(get(handoff.searchParams.get('code')!), { store, issueSession });
    expect(issueSession).toHaveBeenCalledWith('user-1');
    const target = new URL(redeemed.headers.get('location')!);
    expect(`${target.origin}${target.pathname}`).toBe('https://kezek.vercel.app/auth/callback');
    expect(target.searchParams.get('next')).toBe('/select-business');
    expect(target.hash).toBe('#access_token=web-access&refresh_token=web-refresh');

    const replay = await runRedeemWebHandoffHttp(get(handoff.searchParams.get('code')!), { store, issueSession });
    expect(replay.headers.get('location')).toBe('https://kezek.vercel.app/auth/sign-in?error=handoff_expired');
    expect(issueSession).toHaveBeenCalledTimes(1);
});

test('creation requires a signed-in caller', async () => {
    jest.mocked(resolveRequestAuthContext).mockResolvedValue(NextResponse.json({ ok: false }, { status: 401 }));
    expect((await runCreateWebHandoffHttp(post(), { store: mapStore() })).status).toBe(401);
});

test('creation rejects unknown fields and reports a missing store as unavailable', async () => {
    expect((await runCreateWebHandoffHttp(post({ next: '/', userId: 'someone-else' }), { store: mapStore() })).status).toBe(400);
    expect((await runCreateWebHandoffHttp(post(), { store: null })).status).toBe(503);
});

test('redemption failures send the browser to sign-in without issuing a session', async () => {
    const issueSession = jest.fn();
    const unavailable = await runRedeemWebHandoffHttp(get('a'.repeat(43)), { store: null, issueSession });
    expect(unavailable.headers.get('location')).toBe('https://kezek.vercel.app/auth/sign-in?error=handoff_unavailable');

    const broken: WebHandoffStore = { put: async () => true, take: async () => { throw new Error('redis down'); } };
    const storeDown = await runRedeemWebHandoffHttp(get('a'.repeat(43)), { store: broken, issueSession });
    expect(storeDown.headers.get('location')).toBe('https://kezek.vercel.app/auth/sign-in?error=handoff_unavailable');
    expect(issueSession).not.toHaveBeenCalled();
});

test('a failed session issue is reported, not turned into a half sign-in', async () => {
    const store = mapStore();
    const { url } = await (await runCreateWebHandoffHttp(post(), { store })).json();
    const issueSession = jest.fn().mockRejectedValue(new Error('auth down'));

    const response = await runRedeemWebHandoffHttp(get(new URL(url).searchParams.get('code')!), { store, issueSession });

    expect(response.headers.get('location')).toBe('https://kezek.vercel.app/auth/sign-in?error=handoff_failed');
});
