'use client';

import { useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { logWarn } from '@/lib/log';
import { loadYandexMaps } from '@/lib/yamaps';

/* =======================
 *  Минимальные типы YMaps
 * ======================= */
type Coordinates = [number, number];

type PositionOpt = { right?: number; left?: number; top?: number; bottom?: number };

interface IEvent {
    get<T = unknown>(key: string): T;
}
interface IEventManager {
    add(type: string, cb: (e: IEvent) => void): void;
}

interface IGeometry {
    getCoordinates(): Coordinates;
    setCoordinates(coords: Coordinates): void;
}
interface IProperties {
    get<T = unknown>(key: string): T;
}

interface IGeoObject {
    geometry: IGeometry;
    properties: IProperties;
    events: IEventManager;
}

type IPlacemark = IGeoObject;

interface IGeoObjectCollection {
    add(obj: IGeoObject): void;
}

interface IControls {
    add(control: unknown): void;
}

interface IMap {
    controls: IControls;
    geoObjects: IGeoObjectCollection;
    events: IEventManager;
    setCenter(coords: Coordinates, zoom?: number, params?: { duration?: number }): void;
    destroy(): void;
}

type ZoomControlOptions = { options?: { size?: 'small' | 'large'; position?: PositionOpt } };
type GeolocationControlOptions = { options?: { position?: PositionOpt } };
type SearchControlOptions = { provider?: string; options?: { size?: 'small' | 'large'; position?: PositionOpt; placeholderContent?: string } };

interface ISearchControl {
    events: IEventManager;
    getResultsArray(): Promise<IGeoObject[]>;
}
interface IGeoQueryResult {
    geoObjects: { get(index: number): IGeoObject | undefined };
}

interface IYMaps {
    Map: new (
        container: HTMLElement,
        opts: { center: Coordinates; zoom: number; controls: unknown[] }
    ) => IMap;

    control: {
        ZoomControl: new (opts: ZoomControlOptions) => unknown;
        GeolocationControl: new (opts: GeolocationControlOptions) => unknown;
        SearchControl: new (opts: SearchControlOptions) => ISearchControl;
    };

    Placemark: new (coords: Coordinates, props?: object, opts?: { draggable?: boolean }) => IPlacemark;

    geocode: (coords: Coordinates, opts?: { kind?: string }) => Promise<IGeoQueryResult>;
}

/* ============== Компонент ============== */

type Props = {
    lat?: number | null;
    lon?: number | null;
    yandexMapsApiKey?: string;
    onPick: (lat: number, lon: number, addr?: string) => void;
};

export default function BranchMapPickerYandex({ lat, lon, yandexMapsApiKey, onPick }: Props) {
    const { t } = useLanguage();
    const boxRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<IMap | null>(null);
    const placemarkRef = useRef<IPlacemark | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    // Используем ref для хранения последней версии onPick, чтобы избежать пересоздания карты
    const onPickRef = useRef(onPick);
    
    // Обновляем ref при изменении onPick
    useEffect(() => {
        onPickRef.current = onPick;
    }, [onPick]);

    useEffect(() => {
        let destroyed = false;

        (async () => {
            try {
            setLoadError(false);
            const ymaps = (await loadYandexMaps(yandexMapsApiKey)) as unknown as IYMaps;
                if (destroyed || !boxRef.current) return;

            // Yandex Maps использует формат [lat, lon] для center и Placemark
            const startCenter: Coordinates = lat && lon ? [lat, lon] : [40.5146, 72.8030]; // Ош [lat, lon]
            const startZoom = lat && lon ? 16 : 12;

            const map = new ymaps.Map(boxRef.current, {
                center: startCenter,
                zoom: startZoom,
                controls: [],
            });
            mapRef.current = map;

            // Контролы создаём инстансами, size/position — в options
            const zoom = new ymaps.control.ZoomControl({
                options: { size: 'small', position: { right: 10, top: 10 } },
            });
            map.controls.add(zoom);

            const geolocation = new ymaps.control.GeolocationControl({
                options: { position: { right: 10, top: 60 } },
            });
            map.controls.add(geolocation);

            const search = new ymaps.control.SearchControl({
                provider: 'yandex#search',
                options: {
                    size: 'large',
                    position: { left: 10, top: 10 },
                    placeholderContent: t('branches.map.searchPlaceholder', 'Адрес или объект'),
                },
            });
            map.controls.add(search);

            // Результат поиска → ставим метку и эмитим адрес
            search.events.add('resultshow', async (e: IEvent) => {
                const index = e.get<number>('index');
                const result = await search.getResultsArray();
                const item = result?.[index];
                if (!item) return;

                const coords = item.geometry.getCoordinates();
                setPoint(coords);

                // Достаём удобочитаемый адрес
                // 1) metaDataProperty.GeocoderMetaData.text
                // 2) properties.get('text')
                const meta = item.properties.get<{ GeocoderMetaData?: { text?: string } }>('metaDataProperty');
                const addr = meta?.GeocoderMetaData?.text ?? item.properties.get<string | undefined>('text') ?? undefined;

                // Yandex Maps возвращает координаты в формате [lat, lon]
                onPickRef.current(coords[0], coords[1], addr);
                map.setCenter(coords, 16, { duration: 200 });
            });

            function setPoint(coords: Coordinates) {
                if (!placemarkRef.current) {
                    placemarkRef.current = new ymaps.Placemark(coords, {}, { draggable: true });
                    map.geoObjects.add(placemarkRef.current);
                    placemarkRef.current.events.add('dragend', async () => {
                        const c = placemarkRef.current!.geometry.getCoordinates();
                        await geocodeAndEmit(c);
                    });
                } else {
                    placemarkRef.current.geometry.setCoordinates(coords);
                }
            }

            async function geocodeAndEmit(coords: Coordinates) {
                try {
                    // Yandex Maps использует формат [lat, lon] для координат
                    const res = await ymaps.geocode(coords, { kind: 'house' });
                    const first = res.geoObjects.get(0);
                    let addr: string | undefined;

                    if (first) {
                        const meta = first.properties.get<{ GeocoderMetaData?: { text?: string } }>('metaDataProperty');
                        // у некоторых объектов есть text
                        const text = first.properties.get<string | undefined>('text');
                        // в старых версиях у GeoObject мог быть метод getAddressLine (не у всех)
                        const maybeAddrLine = (first as { getAddressLine?: () => string | undefined }).getAddressLine?.();

                        addr = maybeAddrLine ?? meta?.GeocoderMetaData?.text ?? text ?? undefined;
                    }

                    // Yandex Maps возвращает координаты в формате [lat, lon]
                    onPickRef.current(coords[0], coords[1], addr);
                } catch (error) {
                    logWarn('BranchMapPicker', 'Geocoding unavailable', error);
                    // В случае ошибки все равно передаем координаты
                    onPickRef.current(coords[0], coords[1], undefined);
                }
            }

            // начальная метка (Yandex Maps использует [lat, lon])
            if (lat && lon) setPoint([lat, lon]);

            // клик по карте
            map.events.add('click', async (e: IEvent) => {
                try {
                    const coords = e.get<Coordinates>('coords');
                    if (!coords || !Array.isArray(coords) || coords.length < 2) {
                        logWarn('BranchMapPicker', 'Invalid coordinates from click event', { coords });
                        return;
                    }
                    setPoint(coords);
                    await geocodeAndEmit(coords);
                } catch (error) {
                    logWarn('BranchMapPicker', 'Map click could not be handled', error);
                }
            });
            } catch (error) {
                logWarn('BranchMapPicker', 'Yandex Maps is temporarily unavailable', error);
                if (!destroyed) setLoadError(true);
            }
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                mapRef.current.destroy();
                mapRef.current = null;
            }
            placemarkRef.current = null;
        };
    }, [lat, lon, retryKey, t, yandexMapsApiKey]); // onPick хранится в ref; локаль/повтор пересоздают карту

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="relative h-72 w-full sm:h-80">
                <div ref={boxRef} className="h-full w-full" />
                {loadError ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
                        <div className="p-4 text-center">
                            <p className="mb-2 font-medium text-red-600 dark:text-red-400">
                                {t('branches.map.errorTitle', 'Не удалось загрузить карту')}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('branches.map.errorDescription', 'Карта временно недоступна. Введите адрес филиала вручную.')}
                            </p>
                            <button
                                type="button"
                                onClick={() => setRetryKey((current) => current + 1)}
                                className="mt-4 rounded-lg border border-violet-400/50 px-3 py-2 text-sm font-medium text-violet-600 transition hover:bg-violet-500/10 dark:text-violet-300"
                            >
                                {t('branches.map.retry', 'Повторить загрузку карты')}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-400">
                <span>{t('branches.map.hint', 'Переместите метку или выберите адрес через поиск на карте.')}</span>
                <span className="hidden sm:inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    </svg>
                    {t('branches.map.providerName', 'Яндекс Карты')}
                </span>
            </div>
        </div>
    );
}
