'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { logError } from '@/lib/log';
import { loadYandexMaps } from '@/lib/yamaps';

type BranchItem = {
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    branchName: string;
    address: string | null;
    lat: number;
    lon: number;
    categoryId: string | null;
    categoryName: string | null;
    distanceKm?: number;
};

type YMap = {
    geoObjects: { add: (o: unknown) => void; removeAll: () => void };
    setCenter: (coords: [number, number], zoom?: number, opts?: { duration?: number }) => void;
    destroy: () => void;
};

const DEFAULT_CENTER: [number, number] = [40.5146, 72.803]; // Osh
const DEFAULT_ZOOM = 12;
const NEARBY_ZOOM = 14;

export default function MapPageClient() {
    const { t } = useLanguage();
    const mapRef = useRef<HTMLDivElement>(null);
    const ymapsMapRef = useRef<YMap | null>(null);
    const placemarksRef = useRef<unknown[]>([]);
    const listContainerRef = useRef<HTMLDivElement>(null);

    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [nearbyList, setNearbyList] = useState<BranchItem[] | null>(null);
    const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
    const [categoryId, setCategoryId] = useState<string>('');
    const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);

    const displayList = nearbyList ?? branches;
    const hasDistance = nearbyList != null;

    const fetchMap = useCallback(async (catId: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (catId) params.set('categoryId', catId);
            const res = await fetch(`/api/branches/map?${params}`);
            const json = await res.json();
            if (!json?.ok) throw new Error(json?.message ?? 'Failed to load');
            const data = (json.data ?? []) as BranchItem[];
            setBranches(data);
            setNearbyList(null);
            const ids = Array.from(new Set(data.map((b) => b.categoryId).filter(Boolean))) as string[];
            setCategories(ids.map((id) => ({ id: id!, label: id })));
        } catch (e) {
            logError('MapPage', 'Fetch map failed', e);
            setBranches([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMap(categoryId);
    }, [categoryId, fetchMap]);

    useEffect(() => {
        let destroyed = false;
        (async () => {
            if (!mapRef.current) return;
            try {
                const ymaps = (await loadYandexMaps()) as {
                    Map: new (el: HTMLElement, opts: { center: [number, number]; zoom: number; controls: unknown[] }) => YMap;
                    Placemark: new (coords: [number, number], props: object, opts?: object) => unknown;
                    control: { ZoomControl: new (opts: object) => unknown; GeolocationControl?: new (opts: object) => unknown };
                };
                if (destroyed || !mapRef.current) return;
                const map = new ymaps.Map(mapRef.current, {
                    center: DEFAULT_CENTER,
                    zoom: DEFAULT_ZOOM,
                    controls: [],
                });
                const zoom = new (ymaps.control as { ZoomControl: new (o: object) => unknown }).ZoomControl({
                    options: { size: 'small', position: { right: 10, top: 10 } },
                });
                (map as unknown as { controls: { add: (c: unknown) => void } }).controls.add(zoom);
                ymapsMapRef.current = map as unknown as YMap;
                setMapReady(true);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                const detail = e instanceof Error ? e.stack ?? msg : msg;
                logError('MapPage', 'Yandex Maps init failed', { message: msg, detail });
                setMapError(msg);
            }
        })();
        return () => {
            destroyed = true;
            placemarksRef.current = [];
            if (ymapsMapRef.current) {
                ymapsMapRef.current.destroy();
                ymapsMapRef.current = null;
            }
            setMapReady(false);
        };
    }, []);

    useEffect(() => {
        if (!mapReady || !ymapsMapRef.current) return;
        const ym = (window as unknown as { ymaps?: { Placemark: new (c: [number, number], p: object, o?: object) => unknown } }).ymaps;
        if (!ym) return;
        const map = ymapsMapRef.current;
        const list = displayList;
        try {
            map.geoObjects.removeAll();
        } catch (_) {}
        placemarksRef.current = [];
        list.forEach((b) => {
            const pm = new ym.Placemark(
                [b.lat, b.lon],
                {
                    balloonContentBody: [
                        `<div class="p-2 min-w-[200px]">`,
                        `<div class="font-semibold">${escapeHtml(b.branchName)}</div>`,
                        b.address ? `<div class="text-sm text-gray-600 mt-1">${escapeHtml(b.address)}</div>` : '',
                        b.businessSlug
                            ? `<a href="/b/${encodeURIComponent(b.businessSlug)}/booking" class="inline-block mt-2 text-indigo-600 font-medium">${escapeHtml(t('common.map.book', 'Записаться'))}</a>`
                            : '',
                        `</div>`,
                    ].join(''),
                },
                {}
            );
            (pm as { events: { add: (type: string, fn: () => void) => void } }).events.add('click', () => setSelectedId(b.id));
            map.geoObjects.add(pm);
            placemarksRef.current.push(pm);
        });
    }, [mapReady, displayList, t]);

    const handleFindNearest = useCallback(() => {
        setGeoError(null);
        if (!navigator.geolocation) {
            setGeoError(t('common.map.geoError', 'Не удалось определить местоположение'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setUserPosition({ lat, lon });
                try {
                    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), limit: '20' });
                    if (categoryId) params.set('categoryId', categoryId);
                    const res = await fetch(`/api/branches/nearby?${params}`);
                    const json = await res.json();
                    if (!json?.ok) throw new Error(json?.message ?? 'Failed');
                    const data = (json.data ?? []) as BranchItem[];
                    setNearbyList(data);
                    setSelectedId(data[0]?.id ?? null);
                    if (data[0] && ymapsMapRef.current) {
                        ymapsMapRef.current.setCenter([data[0].lat, data[0].lon], NEARBY_ZOOM, { duration: 300 });
                    }
                    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (e) {
                    logError('MapPage', 'Nearby fetch failed', e);
                    setGeoError(t('common.map.geoError', 'Не удалось определить местоположение'));
                }
            },
            () => setGeoError(t('common.map.geoDenied', 'Доступ к геолокации запрещён. Выберите филиал из списка.')),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, [categoryId, t]);

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] md:flex-row">
            <div className="flex flex-col flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 md:w-80 lg:w-96">
                <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-800">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('common.map.title', 'Карта филиалов')}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">{t('common.map.allCategories', 'Все категории')}</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleFindNearest}
                            className="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            {t('common.map.findNearest', 'Ближайший ко мне')}
                        </button>
                    </div>
                    {geoError && (
                        <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
                            {geoError}
                        </p>
                    )}
                </div>
                <div ref={listContainerRef} className="flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <p className="p-4 text-sm text-gray-500">{t('common.loading', 'Загрузка...')}</p>
                    ) : displayList.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">{t('common.noData', 'нет данных')}</p>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                            {displayList.map((b) => (
                                <li key={b.id}>
                                    <div
                                        className={`p-3 cursor-pointer transition-colors ${
                                            selectedId === b.id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }`}
                                        onClick={() => {
                                            setSelectedId(b.id);
                                            ymapsMapRef.current?.setCenter([b.lat, b.lon], NEARBY_ZOOM, { duration: 200 });
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedId(b.id);
                                                ymapsMapRef.current?.setCenter([b.lat, b.lon], NEARBY_ZOOM, { duration: 200 });
                                            }
                                        }}
                                    >
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{b.branchName}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{b.businessName}</div>
                                        {b.address && (
                                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{b.address}</div>
                                        )}
                                        {hasDistance && b.distanceKm != null && (
                                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                                                {b.distanceKm.toFixed(1)} км
                                            </div>
                                        )}
                                        {b.businessSlug && (
                                            <Link
                                                href={`/b/${b.businessSlug}/booking`}
                                                className="inline-block mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {t('common.map.book', 'Записаться')}
                                            </Link>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-[300px] md:min-h-0 relative">
                {!mapReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 p-4">
                        {mapError ? (
                            <>
                                <p className="font-medium text-amber-700 dark:text-amber-400">
                                    {t('common.map.loadingMap', 'Загрузка карты...')} — ошибка
                                </p>
                                <p className="text-sm max-w-lg text-center break-words" title={mapError}>
                                    {mapError}
                                </p>
                            </>
                        ) : (
                            <p>{t('common.map.loadingMap', 'Загрузка карты...')}</p>
                        )}
                    </div>
                )}
                <div ref={mapRef} className="w-full h-full min-h-[300px]" />
            </div>
        </div>
    );
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
