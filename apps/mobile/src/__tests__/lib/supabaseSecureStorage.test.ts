import * as SecureStore from 'expo-secure-store';

import { secureSessionStorage } from '../../lib/secureSessionStorage';

describe('Supabase secure session storage', () => {
    const secureStore = new Map<string, string>();

    beforeEach(() => {
        secureStore.clear();
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            secureStore.get(key) ?? null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                secureStore.set(key, value);
            },
        );
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
            secureStore.delete(key);
        });
    });

    test('is configured for persistent SecureStore-backed sessions', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../../lib/supabase.ts'),
            'utf8',
        );

        expect(source).toContain("import { secureSessionStorage } from './secureSessionStorage'");
        expect(source).toContain('persistSession: true');
        expect(source).toContain('storage: secureSessionStorage');
        expect(source).not.toContain('AsyncStorage');
    });

    test('removes the primary key, metadata, and every session chunk', async () => {
        const sessionKey = 'sb-project-auth-token';
        secureStore.set(`${sessionKey}__chunks_meta`, '3');
        secureStore.set(`${sessionKey}__chunk_0`, 'access');
        secureStore.set(`${sessionKey}__chunk_1`, 'refresh');
        secureStore.set(`${sessionKey}__chunk_2`, 'metadata');
        secureStore.set(sessionKey, 'stale-session');

        await secureSessionStorage.removeItem(sessionKey);

        expect([...secureStore.keys()]).toEqual([]);
    });
});
