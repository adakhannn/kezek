import { runMobileExchangeGet, runMobileExchangePost } from '@/lib/mobileExchangeRouteService';
import { redeemMobileSessionGrant } from '@/lib/mobileExchangeService';
jest.mock('@/lib/mobileExchangeService', () => ({ redeemMobileSessionGrant: jest.fn() }));
test('GET is permanently gone and exposes no pending identity/code', () => {
    expect(runMobileExchangeGet()).toMatchObject({ ok: false, status: 410, error: 'gone' });
    expect(runMobileExchangeGet()).not.toHaveProperty('payload');
});
test('POST only delegates bound redemption', async () => {
    (redeemMobileSessionGrant as jest.Mock).mockResolvedValue({ ok: false, status: 400 });
    await runMobileExchangePost({ code: 'code', codeVerifier: 'proof' });
    expect(redeemMobileSessionGrant).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'proof' });
});
