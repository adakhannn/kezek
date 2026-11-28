import {
    listPushTokens, maskPushToken, MAX_PUSH_TOKENS_PER_USER, registerPushToken, removeInvalidPushToken, unregisterPushToken,
} from '@/lib/pushTokens';

type Call = { method: string; args: unknown[] };

/** A chainable query mock that records calls and resolves to the next result when awaited. */
function table(results: Array<{ data?: unknown; error?: unknown }>) {
    const calls: Call[][] = [];
    const from = jest.fn(() => {
        const own: Call[] = [];
        calls.push(own);
        const result = results.shift() ?? { data: null, error: null };
        const chain: Record<string, unknown> = {};
        for (const method of ['upsert', 'select', 'eq', 'in', 'order', 'delete']) {
            chain[method] = (...args: unknown[]) => { own.push({ method, args }); return chain; };
        }
        chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
        return chain;
    });
    return { client: { from } as never, from, calls };
}

const TOKEN = 'ExponentPushToken[synthetic-install-0001]';

test('register upserts by token (moving it from another account) and prunes installs beyond the cap', async () => {
    const ids = Array.from({ length: MAX_PUSH_TOKENS_PER_USER + 2 }, (_, i) => ({ id: `id-${i}` }));
    const { client, calls } = table([{ error: null }, { data: ids, error: null }, { error: null }]);
    await registerPushToken(client, 'user-1', { token: TOKEN, platform: 'ios', deviceName: '' });
    expect(calls[0][0]).toEqual({ method: 'upsert', args: [
        expect.objectContaining({ user_id: 'user-1', token: TOKEN, platform: 'ios', device_name: null, last_error: null }), { onConflict: 'token' }] });
    expect(calls[2]).toEqual([{ method: 'delete', args: [] }, { method: 'in', args: ['id', ['id-10', 'id-11']] }]);
});

test('register within the cap deletes nothing; a write error throws', async () => {
    let mock = table([{ error: null }, { data: [{ id: 'a' }], error: null }]);
    await registerPushToken(mock.client, 'user-1', { token: TOKEN, platform: 'android' });
    expect(mock.from).toHaveBeenCalledTimes(2);
    mock = table([{ error: { message: 'down' } }]);
    await expect(registerPushToken(mock.client, 'user-1', { token: TOKEN, platform: 'android' })).rejects.toThrow('PUSH_TOKEN_REGISTER_FAILED');
});

test('unregister is scoped to the user; removal after DeviceNotRegistered is by token only', async () => {
    let mock = table([{ error: null }]);
    await unregisterPushToken(mock.client, 'user-1', TOKEN);
    expect(mock.calls[0]).toEqual([{ method: 'delete', args: [] }, { method: 'eq', args: ['user_id', 'user-1'] }, { method: 'eq', args: ['token', TOKEN] }]);
    mock = table([{ error: null }]);
    await removeInvalidPushToken(mock.client, TOKEN);
    expect(mock.calls[0]).toEqual([{ method: 'delete', args: [] }, { method: 'eq', args: ['token', TOKEN] }]);
});

test('list reads distinct users once, skips the query without users, and throws on a read error', async () => {
    let mock = table([{ data: [], error: null }, { data: [{ user_id: 'a', token: TOKEN }], error: null }]);
    expect(await listPushTokens(mock.client, ['a', 'a', ''])).toEqual([{ user_id: 'a', token: TOKEN }]);
    expect(mock.from).toHaveBeenNthCalledWith(1, 'account_deletion_requests');
    expect(mock.calls[0]).toContainEqual({ method: 'eq', args: ['status', 'pending'] });
    expect(mock.from).toHaveBeenNthCalledWith(2, 'push_tokens');
    expect(mock.calls[1]).toContainEqual({ method: 'in', args: ['user_id', ['a']] });
    mock = table([]);
    expect(await listPushTokens(mock.client, [])).toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
    mock = table([{ data: [], error: null }, { data: null, error: { message: 'down' } }]);
    await expect(listPushTokens(mock.client, ['a'])).rejects.toThrow('PUSH_TOKEN_LIST_FAILED');
    mock = table([{ data: null, error: { message: 'down' } }]);
    await expect(listPushTokens(mock.client, ['a'])).rejects.toThrow('PUSH_TOKEN_LIST_FAILED');
});

test('a user with a pending account deletion gets no push, like the other channels', async () => {
    let mock = table([{ data: [{ user_id: 'leaving' }], error: null }, { data: [{ user_id: 'staying', token: TOKEN }], error: null }]);
    expect(await listPushTokens(mock.client, ['leaving', 'staying'])).toEqual([{ user_id: 'staying', token: TOKEN }]);
    expect(mock.calls[0]).toContainEqual({ method: 'in', args: ['user_id', ['leaving', 'staying']] });
    expect(mock.calls[1]).toContainEqual({ method: 'in', args: ['user_id', ['staying']] });
    // Nobody left to notify: the token table is not read at all.
    mock = table([{ data: [{ user_id: 'leaving' }], error: null }]);
    expect(await listPushTokens(mock.client, ['leaving'])).toEqual([]);
    expect(mock.from).toHaveBeenCalledTimes(1);
});

test('a masked token cannot be used', () => {
    expect(maskPushToken(TOKEN)).toBe('ExpoPushToken[synt…0001]');
    expect(maskPushToken('ExponentPushToken[short]')).toBe('ExpoPushToken[…]');
});
