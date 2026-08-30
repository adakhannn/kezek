/** @jest-environment jsdom */

import { loadYandexMaps } from '@/lib/yamaps';

jest.mock('@/lib/env', () => ({
    getYandexMapsApiKey: jest.fn(() => 'test-map-key'),
}));

describe('loadYandexMaps recovery', () => {
    afterEach(() => {
        document.getElementById('kezek-yandex-maps-api')?.remove();
        delete window.ymaps;
    });

    it('clears a rejected cached load so a later retry creates a new request', async () => {
        const firstLoad = loadYandexMaps();
        const firstScript = document.getElementById('kezek-yandex-maps-api') as HTMLScriptElement;

        firstScript.dispatchEvent(new Event('error'));
        await expect(firstLoad).rejects.toThrow('Script failed to load');
        expect(firstScript.isConnected).toBe(false);

        const retryLoad = loadYandexMaps();
        const retryScript = document.getElementById('kezek-yandex-maps-api') as HTMLScriptElement;
        expect(retryScript).not.toBe(firstScript);

        retryScript.dispatchEvent(new Event('error'));
        await expect(retryLoad).rejects.toThrow('Script failed to load');
    });
});
