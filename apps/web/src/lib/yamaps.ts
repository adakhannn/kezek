// apps/web/src/lib/yamaps.ts
import type ymaps from "yandex-maps";

import { getYandexMapsApiKey } from './env';

declare global {
    interface Window {
        ymaps?: typeof ymaps;
    }
}

let loadPromise: Promise<typeof ymaps> | null = null;

export function loadYandexMaps(apiKey?: string): Promise<typeof ymaps> {
    if (typeof window === 'undefined') throw new Error('run in client only');

    const key = apiKey || getYandexMapsApiKey();
    
    if (!key || key.trim() === '') {
        return Promise.reject(
            new Error(
                'NEXT_PUBLIC_YANDEX_MAPS_API_KEY is not set. Set it in the hosting Environment Variables (Production) and redeploy, or pass yandexMapsApiKey from the server.'
            )
        );
    }

    if (window.ymaps) {
        return Promise.resolve(window.ymaps);
    }

    if (!loadPromise) {
        loadPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
            s.async = true;
            s.onload = () => {
                const ym = window.ymaps;
                if (!ym) {
                    return reject(
                        new Error(
                            '[yamaps] Script loaded but window.ymaps is undefined. Possible causes: API key invalid or domain not allowed in Yandex Developer Console.'
                        )
                    );
                }
                try {
                    ym.ready(() => resolve(ym));
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    reject(new Error(`[yamaps] ym.ready threw: ${msg}`));
                }
            };
            s.onerror = () =>
                reject(
                    new Error(
                        '[yamaps] Script failed to load (network or CORS). Check API key, allowed referrers in Yandex Console, and browser Network tab for api-maps.yandex.ru.'
                    )
                );
            document.head.appendChild(s);
        });
    }
    return loadPromise;
}
