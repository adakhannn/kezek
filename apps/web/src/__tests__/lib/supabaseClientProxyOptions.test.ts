const createBrowserClient = jest.fn(() => ({}));
jest.mock('@supabase/ssr', () => ({ createBrowserClient }));

const PROXY_ENV = 'NEXT_PUBLIC_SUPABASE_PROXY_URL';

afterEach(() => {
    delete process.env[PROXY_ENV];
    createBrowserClient.mockClear();
    jest.resetModules();
});

function loadClient() {
    jest.isolateModules(() => {
        require('@/lib/supabaseClient');
    });
}

test('without a proxy URL the browser client is created exactly as before (URL and key only)', () => {
    loadClient();
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    expect(createBrowserClient.mock.calls[0]).toEqual(['https://test.supabase.co', 'test-anon-key']);
});

test('with a proxy URL the client keeps the project URL (same cookie name) and gets a proxy fetch', () => {
    process.env[PROXY_ENV] = 'https://kezek.vercel.app/sb';
    loadClient();
    const [url, key, options] = createBrowserClient.mock.calls[0] as unknown as [string, string, { global: { fetch: unknown } }];
    expect(url).toBe('https://test.supabase.co');
    expect(key).toBe('test-anon-key');
    expect(typeof options.global.fetch).toBe('function');
});
