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
    container?: { fitToViewport: () => void };
    destroy: () => void;
};

const DEFAULT_CENTER: [number, number] = [40.5146, 72.803]; // Osh
const DEFAULT_ZOOM = 12;
const NEARBY_ZOOM = 14;

type Props = { yandexMapsApiKey?: string | null };

export default function MapPageClient({ yandexMapsApiKey }: Props) {
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
    const [mapLoadFailed, setMapLoadFailed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [geoErrorDenied, setGeoErrorDenied] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

    const displayList = nearbyList ?? branches;
    const hasDistance = nearbyList != null;
    const selectedBranch = displayList.find((branch) => branch.id === selectedId) ?? null;

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
            setUserPosition(null);
            setSelectedId(null);
            setMapLoadFailed(false);
            if (!catId) {
                const categoryLabels = new Map<string, string>();
                data.forEach((branch) => {
                    if (branch.categoryId) {
                        categoryLabels.set(branch.categoryId, branch.categoryName || branch.categoryId);
                    }
                });
                setCategories(Array.from(categoryLabels, ([id, label]) => ({ id, label })));
            }
        } catch (e) {
            logError('MapPage', 'Fetch map failed', e);
            setBranches([]);
            setNearbyList(null);
            setMapLoadFailed(true);
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
                const ymaps = (await loadYandexMaps(yandexMapsApiKey ?? undefined)) as {
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
        } catch {}
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
                { preset: selectedId === b.id ? 'islands#violetIcon' : 'islands#blueIcon' }
            );
            (pm as { events: { add: (type: string, fn: () => void) => void } }).events.add('click', () => setSelectedId(b.id));
            map.geoObjects.add(pm);
            placemarksRef.current.push(pm);
        });
        // Метка «Вы здесь» — зелёный круг (preset + iconColor в options), филиалы — красные булавки
        if (userPosition) {
            const userPm = new ym.Placemark(
                [userPosition.lat, userPosition.lon],
                { balloonContentBody: escapeHtml(t('common.map.youAreHere', 'Вы здесь')) },
                { preset: 'islands#circleDotIcon', iconColor: '#22c55e' }
            );
            map.geoObjects.add(userPm);
            placemarksRef.current.push(userPm);
        }
    }, [mapReady, displayList, userPosition, selectedId, t]);

    const handleBranchSelect = useCallback((branch: BranchItem) => {
        setSelectedId(branch.id);
        ymapsMapRef.current?.setCenter([branch.lat, branch.lon], NEARBY_ZOOM, { duration: 200 });
    }, []);

    useEffect(() => {
        if (mobileView !== 'map' || !mapReady) return;
        const timeoutId = window.setTimeout(() => ymapsMapRef.current?.container?.fitToViewport(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [mapReady, mobileView]);

    const handleFindNearest = useCallback(() => {
        setGeoError(null);
        setGeoErrorDenied(false);
        if (!navigator.geolocation) {
            setGeoError(t('common.map.geoError', 'Не удалось определить местоположение'));
            return;
        }
        setGeoLoading(true);
        // enableHighAccuracy: false — быстрее ответ по сети/сотовой, меньше таймаутов в помещении
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setGeoLoading(false);
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
                    if (data.length === 0) {
                        setGeoError(t('common.map.nearbyEmpty', 'В радиусе 20 км филиалов не найдено. Выберите филиал из списка слева.'));
                    } else {
                        setGeoError(null);
                        if (data[0] && ymapsMapRef.current) {
                            ymapsMapRef.current.setCenter([data[0].lat, data[0].lon], NEARBY_ZOOM, { duration: 300 });
                        }
                        listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } catch (e) {
                    logError('MapPage', 'Nearby fetch failed', e);
                    setGeoError(t('common.map.nearbyFetchError', 'Ошибка при поиске ближайших филиалов. Попробуйте позже.'));
                }
            },
            (err: GeolocationPositionError) => {
                setGeoLoading(false);
                // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
                if (err.code === 1) {
                    setGeoError(t('common.map.geoDenied', 'Доступ к геолокации запрещён. Выберите филиал из списка.'));
                    setGeoErrorDenied(true);
                } else {
                    setGeoError(t('common.map.geoUnavailable', 'Не удалось определить местоположение. Убедитесь, что геолокация включена на устройстве, и попробуйте снова.'));
                }
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
        );
    }, [categoryId, t]);

    return (
        <section className="mx-auto w-full max-w-[var(--container-xl)] px-3 py-5 sm:px-5 sm:py-7 lg:px-6 lg:py-8">
            <div className="mb-5 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] shadow-[var(--shadow-xs)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" aria-hidden="true" />
                        {displayList.length} {t('common.map.places', 'мест для записи')}
                    </div>
                    <h1 className="type-page-title text-[var(--text-primary)]">
                        {t('common.map.title', 'Карта филиалов')}
                    </h1>
                    <p className="type-body mt-2 text-[var(--text-secondary)]">
                        {t('common.map.description', 'Найдите удобный филиал рядом, сравните адреса и сразу перейдите к записи.')}
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                    <label className="sr-only" htmlFor="map-category-filter">
                        {t('common.map.categoryLabel', 'Категория')}
                    </label>
                    <select
                        id="map-category-filter"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="min-h-[46px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]"
                    >
                        <option value="">{t('common.map.allCategories', 'Все категории')}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleFindNearest}
                        disabled={geoLoading}
                        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] disabled:cursor-wait disabled:opacity-70"
                    >
                        <LocationIcon />
                        {geoLoading ? t('common.map.geoLocating', 'Определяем местоположение...') : t('common.map.findNearest', 'Ближайший ко мне')}
                    </button>
                </div>
            </div>

            {geoError ? (
                <div className="mb-4 rounded-[var(--radius-md)] border border-[color:color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning)_10%,var(--surface-card))] px-4 py-3" role="alert">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{geoError}</p>
                    {geoErrorDenied ? (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {t('common.map.geoDeniedHint', 'Чтобы включить: нажмите на значок замка или «i» в адресной строке → Настройки сайта → Местоположение → Разрешить, затем нажмите кнопку снова.')}
                        </p>
                    ) : null}
                </div>
            ) : null}

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-1 lg:hidden" aria-label={t('common.map.viewMode', 'Режим просмотра')}>
                <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    aria-pressed={mobileView === 'list'}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition-all ${
                        mobileView === 'list'
                            ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                            : 'text-[var(--text-secondary)]'
                    }`}
                >
                    <ListIcon />
                    {t('common.map.listView', 'Список')}
                </button>
                <button
                    type="button"
                    onClick={() => setMobileView('map')}
                    aria-pressed={mobileView === 'map'}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition-all ${
                        mobileView === 'map'
                            ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                            : 'text-[var(--text-secondary)]'
                    }`}
                >
                    <MapIcon />
                    {t('common.map.mapView', 'Карта')}
                </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.55fr)] lg:items-stretch">
                <div
                    ref={listContainerRef}
                    className={`${mobileView === 'map' ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-md)] lg:h-[680px]`}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                                {hasDistance ? t('common.map.nearbyTitle', 'Ближайшие филиалы') : t('common.map.resultsTitle', 'Доступные филиалы')}
                            </h2>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {t('common.map.selectHint', 'Выберите карточку, чтобы показать её на карте')}
                            </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--surface-emphasis)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                            {displayList.length}
                        </span>
                    </div>

                    <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
                        {loading ? (
                            <div className="space-y-3 p-4" aria-label={t('common.loading', 'Загрузка...')}>
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="h-36 animate-pulse rounded-[18px] bg-[var(--surface-emphasis)]" />
                                ))}
                            </div>
                        ) : mapLoadFailed ? (
                            <div className="m-4 rounded-[18px] bg-[var(--surface-emphasis)] p-5 text-center" role="alert">
                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                    {t('common.map.branchesFetchError', 'Не удалось загрузить филиалы. Попробуйте обновить список.')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => fetchMap(categoryId)}
                                    className="mt-4 min-h-[42px] rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-inverse)]"
                                >
                                    {t('common.map.retryBranches', 'Попробовать снова')}
                                </button>
                            </div>
                        ) : displayList.length === 0 ? (
                            <div className="m-4 rounded-[18px] bg-[var(--surface-emphasis)] p-6 text-center">
                                <p className="text-sm font-medium text-[var(--text-primary)]">{t('common.map.emptyTitle', 'Филиалы не найдены')}</p>
                                <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('common.map.emptyHint', 'Попробуйте выбрать другую категорию.')}</p>
                            </div>
                        ) : (
                            <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-1">
                                {displayList.map((branch, index) => {
                                    const selected = selectedId === branch.id;
                                    return (
                                        <li key={branch.id}>
                                            <article className={`overflow-hidden rounded-[18px] border transition-all ${selected ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-card))] shadow-[var(--shadow-sm)]' : 'border-[var(--border-subtle)] bg-[var(--surface-base)] hover:border-[var(--border-default)]'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleBranchSelect(branch)}
                                                    aria-pressed={selected}
                                                    className="w-full px-4 pb-3 pt-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]' : 'bg-[var(--surface-emphasis)] text-[var(--accent-primary)]'}`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block font-semibold leading-snug text-[var(--text-primary)]">{branch.branchName}</span>
                                                            <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">{branch.businessName}</span>
                                                        </span>
                                                        {hasDistance && branch.distanceKm != null ? (
                                                            <span className="shrink-0 rounded-full bg-[var(--surface-emphasis)] px-2 py-1 text-xs font-semibold text-[var(--accent-primary)]">
                                                                {branch.distanceKm.toFixed(1)} {t('common.map.km', 'км')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {branch.address ? (
                                                        <span className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
                                                            <PinIcon />
                                                            <span>{branch.address}</span>
                                                        </span>
                                                    ) : null}
                                                </button>
                                                <div className="flex gap-2 border-t border-[var(--border-subtle)] p-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleBranchSelect(branch);
                                                            setMobileView('map');
                                                        }}
                                                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] lg:hidden"
                                                    >
                                                        <MapIcon />
                                                        {t('common.map.showOnMap', 'На карте')}
                                                    </button>
                                                    {branch.businessSlug ? (
                                                        <Link
                                                            href={`/b/${branch.businessSlug}/booking`}
                                                            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 text-sm font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-xs)]"
                                                        >
                                                            {t('common.map.book', 'Записаться')}
                                                            <span className="ml-1.5" aria-hidden="true">→</span>
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            </article>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                <div className={`${mobileView === 'list' ? 'hidden lg:block' : 'block'} relative h-[min(68vh,42rem)] min-h-[28rem] min-w-0 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] shadow-[var(--shadow-md)] lg:h-[680px]`}>
                    {!mapReady ? (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--surface-emphasis)] p-5 text-[var(--text-secondary)]">
                            {mapError ? (
                                <div role="alert" data-testid="map-provider-unavailable" className="max-w-md text-center">
                                    <p className="font-semibold text-[var(--text-primary)]">{t('common.map.unavailableTitle', 'Карта временно недоступна')}</p>
                                    <p className="mt-2 text-sm">{t('common.map.unavailableHint', 'Выберите филиал из списка — запись продолжает работать.')}</p>
                                </div>
                            ) : (
                                <>
                                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" aria-hidden="true" />
                                    <p className="text-sm font-medium">{t('common.map.loadingMap', 'Загрузка карты...')}</p>
                                </>
                            )}
                        </div>
                    ) : null}
                    <div ref={mapRef} className="h-full min-h-[28rem] w-full" />

                    {selectedBranch ? (
                        <div className="absolute bottom-9 left-3 right-3 z-[5] rounded-[18px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] p-3 shadow-[var(--shadow-lg)] backdrop-blur-md sm:left-4 sm:right-auto sm:w-[22rem]">
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-sm font-bold text-[var(--text-inverse)]">
                                    {displayList.findIndex((branch) => branch.id === selectedBranch.id) + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold leading-snug text-[var(--text-primary)]">{selectedBranch.branchName}</p>
                                    {selectedBranch.address ? <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{selectedBranch.address}</p> : null}
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMobileView('list')}
                                    className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-primary)] lg:hidden"
                                >
                                    {t('common.map.backToList', 'К списку')}
                                </button>
                                {selectedBranch.businessSlug ? (
                                    <Link
                                        href={`/b/${selectedBranch.businessSlug}/booking`}
                                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 text-sm font-semibold text-[var(--text-inverse)]"
                                    >
                                        {t('common.map.book', 'Записаться')}
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

function LocationIcon() {
    return (
        <svg className="h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s6-4.35 6-11a6 6 0 10-12 0c0 6.65 6 11 6 11z" />
            <circle cx="12" cy="10" r="2" strokeWidth={2} />
        </svg>
    );
}

function PinIcon() {
    return (
        <svg className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg className="h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
    );
}

function MapIcon() {
    return (
        <svg className="h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15" />
        </svg>
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
