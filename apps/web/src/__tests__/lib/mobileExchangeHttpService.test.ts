import { NextRequest } from 'next/server';
import { runMobileExchangeGetHttp, runMobileExchangePostHttp } from '@/lib/mobileExchangeHttpService';
import { runMobileExchangePost } from '@/lib/mobileExchangeRouteService';
jest.mock('@/lib/mobileExchangeRouteService', () => ({
    runMobileExchangeGet: () => ({ ok: false, status: 410, error: 'gone', message: 'Update app' }),
    runMobileExchangePost: jest.fn(),
}));
const request = (body: unknown) => new NextRequest('http://localhost/api/auth/mobile-exchange', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => jest.clearAllMocks());
test('POST redeems proof and forbids caching credentials', async () => {
    (runMobileExchangePost as jest.Mock).mockResolvedValue({ ok: true, payload: { accessToken: 'access', refreshToken: 'refresh' } });
    const response = await runMobileExchangePostHttp(request({ code: 'code', codeVerifier: 'proof' }));
    expect(runMobileExchangePost).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'proof' });
    expect(await response.json()).toMatchObject({ data: { accessToken: 'access', refreshToken: 'refresh' } });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
});
test.each([{ accessToken: 'access', refreshToken: 'refresh' }, null, [], { code: 'code', codeVerifier: 'proof', userId: 'other' }])('rejects token ingress and extra fields', async body => {
    expect((await runMobileExchangePostHttp(request(body))).status).toBe(400);
    expect(runMobileExchangePost).not.toHaveBeenCalled();
});
test('GET never exposes latest pending grant', async () => {
    const response = await runMobileExchangeGetHttp();
    expect(response.status).toBe(410);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).not.toHaveProperty('data');
});
test('fails closed without leaking provider/storage failures', async () => {
    (runMobileExchangePost as jest.Mock).mockRejectedValue(new Error('secret-provider-body'));
    const response = await runMobileExchangePostHttp(request({ code: 'code', codeVerifier: 'proof' }));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).not.toContain('secret-provider-body');
});
