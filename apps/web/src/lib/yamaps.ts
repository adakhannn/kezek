// apps/web/src/lib/yamaps.ts
import ymaps from "yandex-maps";

let loadPromise: Promise<typeof ymaps> | null = null;

export function loadYandexMaps(apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY!) {
    if (typeof window === 'undefined') throw new Error('run in client only');

    if ((window).ymaps) {
        return Promise.resolve((window).ymaps as typeof ymaps);
    }

    if (!loadPromise) {
        loadPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
            s.async = true;
            s.onload = () => {
                const ym = (window).ymaps as typeof ymaps | undefined;
                if (!ym) return reject(new Error('Yandex Maps not available on window'));
                ym.ready(() => resolve(ym));
            };
            s.onerror = () => reject(new Error('Yandex Maps failed to load'));
            document.head.appendChild(s);
        });
    }
    return loadPromise;
}
