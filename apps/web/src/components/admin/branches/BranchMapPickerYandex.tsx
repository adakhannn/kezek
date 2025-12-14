'use client';

import { useEffect, useRef } from 'react';

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
type SearchControlOptions = { provider?: string; options?: { size?: 'small' | 'large'; position?: PositionOpt } };

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
    onPick: (lat: number, lon: number, addr?: string) => void;
};

export default function BranchMapPickerYandex({ lat, lon, onPick }: Props) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<IMap | null>(null);
    const placemarkRef = useRef<IPlacemark | null>(null);

    useEffect(() => {
        let destroyed = false;

        (async () => {
            const ymaps = (await loadYandexMaps()) as unknown as IYMaps;
            if (destroyed || !boxRef.current) return;

            // Yandex Maps использует формат [lon, lat], но мы храним [lat, lon]
            // Поэтому при инициализации карты меняем местами
            const startCenter: Coordinates = lat && lon ? [lon, lat] : [72.8030, 40.5146]; // Ош [lon, lat]
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
                options: { size: 'large', position: { left: 10, top: 10 } },
            });
            map.controls.add(search);

            // Результат поиска → ставим метку и эмитим адрес
            search.events.add('resultshow', async (e) => {
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

                // Yandex Maps использует формат [lon, lat], но мы храним [lat, lon]
                // Поэтому меняем местами при вызове onPick
                onPick(coords[1], coords[0], addr);
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
                    // В Yandex Maps координаты в формате [долгота, широта] = [lon, lat]
                    // Но мы передаем в onPick как [lat, lon], поэтому нужно поменять местами
                    const res = await ymaps.geocode(coords, { kind: 'house' });
                    const first = res.geoObjects.get(0);
                    let addr: string | undefined;

                    if (first) {
                        const meta = first.properties.get<{ GeocoderMetaData?: { text?: string } }>('metaDataProperty');
                        // у некоторых объектов есть text
                        const text = first.properties.get<string | undefined>('text');
                        // в старых версиях у GeoObject мог быть метод getAddressLine (не у всех)
                        const maybeAddrLine = (first as unknown as { getAddressLine?: () => string | undefined }).getAddressLine?.();

                        addr = maybeAddrLine ?? meta?.GeocoderMetaData?.text ?? text ?? undefined;
                    }

                    // Yandex Maps использует формат [lon, lat], но мы храним [lat, lon]
                    // Поэтому меняем местами при вызове onPick
                    onPick(coords[1], coords[0], addr);
                } catch (error) {
                    console.error('Geocoding error:', error);
                    // В случае ошибки все равно передаем координаты
                    onPick(coords[1], coords[0], undefined);
                }
            }

            // начальная метка (Yandex Maps использует [lon, lat])
            if (lat && lon) setPoint([lon, lat]);

            // клик по карте
            map.events.add('click', async (e) => {
                try {
                    const coords = e.get<Coordinates>('coords');
                    if (!coords || !Array.isArray(coords) || coords.length < 2) {
                        console.error('Invalid coordinates from click event:', coords);
                        return;
                    }
                    setPoint(coords);
                    await geocodeAndEmit(coords);
                } catch (error) {
                    console.error('Error handling map click:', error);
                }
            });
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                mapRef.current.destroy();
                mapRef.current = null;
            }
            placemarkRef.current = null;
        };
    }, [lat, lon]); // onPick не включаем в зависимости, чтобы карта не пересоздавалась при каждом рендере

    return <div ref={boxRef} className="w-full h-72 rounded border" />;
}
