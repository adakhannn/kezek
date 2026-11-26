/*
 * The message bridge of the branch map picker (BranchMapPicker.tsx): the page in the WebView
 * (mapPickerHtml.ts, Yandex Maps JS API 2.1 as on the website's BranchMapPickerYandex) posts
 * events, React Native sends commands. Pure functions only, so the contract is unit-tested.
 */

/** Every event the page posts carries this tag; other messages are ignored. */
export const MAP_PICKER_SOURCE = 'kezek-map-picker';

/** Bishkek centre: the start of a map with no coordinates, no location and no city. */
export const DEFAULT_MAP_CENTER = { lat: 42.8746, lon: 74.5698 } as const;

export type LatLon = { lat: number; lon: number };

export type PickSource = 'initial' | 'tap' | 'drag' | 'search' | 'locate';

export type MapLoadErrorReason = 'script' | 'timeout' | 'init';

export type SearchResult = LatLon & { title: string; subtitle: string | null; address: string | null };

/** WebView -> React Native. */
export type MapPickerEvent =
    | { type: 'ready' }
    | { type: 'resolving'; lat: number; lon: number; source: PickSource }
    | { type: 'pick'; lat: number; lon: number; address: string | null; geocodeFailed: boolean; source: PickSource }
    | { type: 'searchResults'; query: string; results: SearchResult[] }
    | { type: 'searchError'; query: string }
    | { type: 'error'; reason: MapLoadErrorReason };

/** React Native -> WebView. */
export type MapPickerCommand =
    | { type: 'setPoint'; lat: number; lon: number; address?: string | null; source: PickSource }
    | { type: 'search'; query: string };

const PICK_SOURCES: readonly PickSource[] = ['initial', 'tap', 'drag', 'search', 'locate'];
const ERROR_REASONS: readonly MapLoadErrorReason[] = ['script', 'timeout', 'init'];
const MAX_SEARCH_RESULTS = 8;

export function isValidLatLon(lat: unknown, lon: unknown): boolean {
    return (
        typeof lat === 'number' && typeof lon === 'number' &&
        Number.isFinite(lat) && Number.isFinite(lon) &&
        Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    );
}

function text(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 500) : null;
}

function source(value: unknown): PickSource {
    return PICK_SOURCES.includes(value as PickSource) ? (value as PickSource) : 'tap';
}

function searchResult(value: unknown): SearchResult | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (!isValidLatLon(item.lat, item.lon)) return null;
    const address = text(item.address);
    const title = text(item.title) ?? address;
    if (!title) return null;
    return { lat: item.lat as number, lon: item.lon as number, title, subtitle: text(item.subtitle), address };
}

/** A posted message as a typed event; null for anything the picker page did not produce. */
export function parseMapPickerMessage(data: string): MapPickerEvent | null {
    let raw: unknown;
    try {
        raw = JSON.parse(data);
    } catch {
        return null;
    }
    if (!raw || typeof raw !== 'object') return null;
    const message = raw as Record<string, unknown>;
    if (message.source !== MAP_PICKER_SOURCE) return null;

    switch (message.type) {
        case 'ready':
            return { type: 'ready' };
        case 'resolving':
            if (!isValidLatLon(message.lat, message.lon)) return null;
            return { type: 'resolving', lat: message.lat as number, lon: message.lon as number, source: source(message.from) };
        case 'pick':
            if (!isValidLatLon(message.lat, message.lon)) return null;
            return {
                type: 'pick',
                lat: message.lat as number,
                lon: message.lon as number,
                address: text(message.address),
                geocodeFailed: message.geocodeFailed === true,
                source: source(message.from),
            };
        case 'searchResults': {
            const results = Array.isArray(message.results)
                ? message.results.map(searchResult).filter((item): item is SearchResult => item !== null).slice(0, MAX_SEARCH_RESULTS)
                : [];
            return { type: 'searchResults', query: text(message.query) ?? '', results };
        }
        case 'searchError':
            return { type: 'searchError', query: text(message.query) ?? '' };
        case 'error':
            return {
                type: 'error',
                reason: ERROR_REASONS.includes(message.reason as MapLoadErrorReason) ? (message.reason as MapLoadErrorReason) : 'init',
            };
        default:
            return null;
    }
}

/**
 * The script for WebView.injectJavaScript: the command travels as a JSON string literal and the
 * page parses it, so no value is ever evaluated as code.
 */
export function buildMapPickerCommand(command: MapPickerCommand): string {
    const payload = JSON.stringify(JSON.stringify(command));
    return `window.__kezekMapPicker && window.__kezekMapPicker.run(${payload}); true;`;
}

/* ===================== state of the picker screen ===================== */

export type MapPickerState = {
    status: 'loading' | 'ready' | 'error';
    errorReason: MapLoadErrorReason | null;
    point: LatLon | null;
    address: string | null;
    /** The reverse geocoder is looking up the address of `point`. */
    resolving: boolean;
    /** The geocoder failed for `point`: coordinates are kept, the address is typed in the form. */
    geocodeFailed: boolean;
    search: { status: 'idle' | 'searching' | 'done' | 'error'; query: string; results: SearchResult[] };
};

export function initialMapPickerState(start: { point: LatLon | null; address?: string | null }): MapPickerState {
    return {
        status: 'loading',
        errorReason: null,
        point: start.point,
        address: start.point ? (start.address?.trim() || null) : null,
        resolving: false,
        geocodeFailed: false,
        search: { status: 'idle', query: '', results: [] },
    };
}

export type MapPickerAction =
    | MapPickerEvent
    | { type: 'reload' }
    | { type: 'searchStart'; query: string }
    | { type: 'searchClear' }
    | { type: 'chooseResult'; result: SearchResult };

export function mapPickerReducer(state: MapPickerState, action: MapPickerAction): MapPickerState {
    switch (action.type) {
        case 'ready':
            return { ...state, status: 'ready', errorReason: null };
        case 'error':
            return { ...state, status: 'error', errorReason: action.reason };
        case 'reload':
            return { ...state, status: 'loading', errorReason: null, resolving: false };
        case 'resolving':
            return {
                ...state,
                point: { lat: action.lat, lon: action.lon },
                address: null,
                resolving: true,
                geocodeFailed: false,
            };
        case 'pick':
            return {
                ...state,
                point: { lat: action.lat, lon: action.lon },
                address: action.address,
                resolving: false,
                geocodeFailed: action.geocodeFailed,
            };
        case 'searchStart':
            return { ...state, search: { status: 'searching', query: action.query, results: [] } };
        case 'searchResults':
            // A late answer to an older query is dropped.
            if (action.query !== state.search.query) return state;
            return { ...state, search: { status: 'done', query: action.query, results: action.results } };
        case 'searchError':
            if (action.query !== state.search.query) return state;
            return { ...state, search: { status: 'error', query: action.query, results: [] } };
        case 'searchClear':
            return { ...state, search: { status: 'idle', query: '', results: [] } };
        case 'chooseResult':
            return {
                ...state,
                point: { lat: action.result.lat, lon: action.result.lon },
                address: action.result.address ?? action.result.title,
                resolving: false,
                geocodeFailed: false,
                search: { status: 'idle', query: '', results: [] },
            };
        default:
            return state;
    }
}

/** What "Выбрать" returns to the form; null until a point is placed and its address settled. */
export function mapPickerResult(state: MapPickerState): { lat: number; lon: number; address: string | null } | null {
    if (!state.point || state.resolving) return null;
    return { lat: state.point.lat, lon: state.point.lon, address: state.address };
}

/* ===================== start and configuration ===================== */

export type MapPickerStart = { center: LatLon; zoom: number; marker: boolean; city: string | null };

/**
 * Where the map opens: on the branch's coordinates (with the marker), else on the phone's known
 * position, else on the business city (the page geocodes it), else on Bishkek.
 */
export function resolveMapPickerStart({ point, userLocation, city }: {
    point: LatLon | null;
    userLocation?: LatLon | null;
    city?: string | null;
}): MapPickerStart {
    if (point && isValidLatLon(point.lat, point.lon)) return { center: point, zoom: 17, marker: true, city: null };
    if (userLocation && isValidLatLon(userLocation.lat, userLocation.lon)) {
        return { center: userLocation, zoom: 15, marker: false, city: null };
    }
    const cityName = city?.trim() || null;
    return { center: { ...DEFAULT_MAP_CENTER }, zoom: cityName ? 12 : 11, marker: false, city: cityName };
}

/** The Yandex Maps JS API language: Kyrgyz is not offered, the Russian map is the closest. */
export function yandexMapsLang(locale: string): 'ru_RU' | 'en_US' {
    return locale === 'en' ? 'en_US' : 'ru_RU';
}

/**
 * The Yandex Maps JS API key: the website's NEXT_PUBLIC_YANDEX_MAPS_API_KEY, given to the app build
 * as EXPO_PUBLIC_YANDEX_MAPS_API_KEY (or expo.extra.yandexMapsApiKey). Null when not configured.
 */
export function resolveYandexMapsApiKey(fromEnv: string | undefined, fromExtra: unknown): string | null {
    const value = (fromEnv && fromEnv.trim()) || (typeof fromExtra === 'string' ? fromExtra.trim() : '');
    return value || null;
}
