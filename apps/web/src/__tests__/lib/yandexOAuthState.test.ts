jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
import { createHash } from 'node:crypto';
import { getServiceClient } from '@/lib/supabaseService';
import { createYandexOAuthState, consumeYandexOAuthState } from '@/lib/yandexOAuthState';

describe('Yandex state persistence boundary', () => {
    const rpc = jest.fn();
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(getServiceClient).mockReturnValue({ rpc } as never);
        rpc.mockResolvedValue({ data: null, error: null });
    });
    test('stores only a hash of an unpredictable state and a sanitized return path', async () => {
        const state = await createYandexOAuthState('sign_in', null, 'https://attacker.invalid');
        expect(state).toMatch(/^[a-f0-9]{64}$/);
        expect(rpc).toHaveBeenCalledWith('create_yandex_oauth_state', {
            p_state_hash: createHash('sha256').update(state).digest('hex'), p_flow: 'sign_in', p_user_id: null, p_return_path: '/',
        });
        expect(JSON.stringify(rpc.mock.calls)).not.toContain(state);
    });
    test('requires a successful atomic RPC matching the requested flow and user', async () => {
        rpc.mockResolvedValue({ data: { flow: 'link', user_id: 'caller', return_path: '/cabinet/profile' }, error: null });
        expect(await consumeYandexOAuthState('a'.repeat(64), 'link', 'caller')).toEqual({ returnPath: '/cabinet/profile' });
        expect(rpc).toHaveBeenCalledWith('consume_yandex_oauth_state', expect.objectContaining({ p_flow: 'link', p_user_id: 'caller' }));
        expect(await consumeYandexOAuthState('a'.repeat(64), 'link', 'other')).toBeNull();
        expect(await consumeYandexOAuthState('a'.repeat(64), 'sign_in', null)).toBeNull();
    });
    test('malformed, expired or consumed state never yields an attempt', async () => {
        expect(await consumeYandexOAuthState('invalid', 'sign_in', null)).toBeNull();
        expect(rpc).not.toHaveBeenCalled();
        expect(await consumeYandexOAuthState('a'.repeat(64), 'sign_in', null)).toBeNull();
    });
    test('does not bypass an unavailable persistence layer', async () => {
        rpc.mockResolvedValue({ data: { flow: 'sign_in', user_id: null }, error: { message: 'missing migration' } });
        await expect(createYandexOAuthState('sign_in', null)).rejects.toThrow('storage unavailable');
        await expect(consumeYandexOAuthState('a'.repeat(64), 'sign_in', null)).rejects.toThrow('storage unavailable');
    });
});
