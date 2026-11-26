import vm from 'node:vm';

import {
    buildMapPickerCommand,
    DEFAULT_MAP_CENTER,
    initialMapPickerState,
    MAP_PICKER_SOURCE,
    mapPickerReducer,
    mapPickerResult,
    parseMapPickerMessage,
    resolveMapPickerStart,
    resolveYandexMapsApiKey,
    yandexMapsLang,
    type MapPickerCommand,
} from '../../screens/manage/catalog/mapPicker/mapPickerBridge';
import { buildMapPickerHtml, scriptSafeJson } from '../../screens/manage/catalog/mapPicker/mapPickerHtml';
import { applyMapPick, mapPickerPointFrom, NEW_BRANCH_FORM } from '../../screens/manage/catalog/branchForm';

const msg = (body: Record<string, unknown>) => JSON.stringify({ source: MAP_PICKER_SOURCE, ...body });

describe('map picker bridge: WebView -> React Native', () => {
    test('parses the events the page posts', () => {
        expect(parseMapPickerMessage(msg({ type: 'ready' }))).toEqual({ type: 'ready' });
        expect(parseMapPickerMessage(msg({ type: 'resolving', lat: 42.8, lon: 74.6, from: 'drag' })))
            .toEqual({ type: 'resolving', lat: 42.8, lon: 74.6, source: 'drag' });
        expect(parseMapPickerMessage(msg({ type: 'pick', lat: 42.8, lon: 74.6, address: '  Бишкек, Чуй 120 ', geocodeFailed: false, from: 'tap' })))
            .toEqual({ type: 'pick', lat: 42.8, lon: 74.6, address: 'Бишкек, Чуй 120', geocodeFailed: false, source: 'tap' });
        expect(parseMapPickerMessage(msg({ type: 'pick', lat: 1, lon: 2, address: '', geocodeFailed: true, from: 'weird' })))
            .toEqual({ type: 'pick', lat: 1, lon: 2, address: null, geocodeFailed: true, source: 'tap' });
        expect(parseMapPickerMessage(msg({ type: 'error', reason: 'timeout' }))).toEqual({ type: 'error', reason: 'timeout' });
        expect(parseMapPickerMessage(msg({ type: 'error', reason: 'other' }))).toEqual({ type: 'error', reason: 'init' });
        expect(parseMapPickerMessage(msg({ type: 'searchError', query: 'Чуй' }))).toEqual({ type: 'searchError', query: 'Чуй' });
    });

    test('ignores foreign, malformed and out-of-range messages', () => {
        expect(parseMapPickerMessage('not json')).toBeNull();
        expect(parseMapPickerMessage('null')).toBeNull();
        expect(parseMapPickerMessage(JSON.stringify({ type: 'ready' }))).toBeNull();
        expect(parseMapPickerMessage(JSON.stringify({ type: 'bookingLink', url: 'x', source: 'other' }))).toBeNull();
        expect(parseMapPickerMessage(msg({ type: 'unknown' }))).toBeNull();
        expect(parseMapPickerMessage(msg({ type: 'pick', lat: 91, lon: 74 }))).toBeNull();
        expect(parseMapPickerMessage(msg({ type: 'pick', lat: '42', lon: 74 }))).toBeNull();
        expect(parseMapPickerMessage(msg({ type: 'resolving', lat: 42, lon: Number.NaN }))).toBeNull();
    });

    test('keeps valid search results only, at most eight', () => {
        const valid = { lat: 42.87, lon: 74.6, title: 'проспект Чуй, 120', subtitle: 'Бишкек, Кыргызстан', address: 'Кыргызстан, Бишкек, проспект Чуй, 120' };
        const parsed = parseMapPickerMessage(msg({
            type: 'searchResults',
            query: 'Чуй 120',
            results: [valid, { lat: 200, lon: 0, title: 'bad' }, { lat: 1, lon: 1 }, 'x', null, ...Array(10).fill({ ...valid, subtitle: '' })],
        }));
        expect(parsed?.type).toBe('searchResults');
        if (parsed?.type !== 'searchResults') return;
        expect(parsed.query).toBe('Чуй 120');
        expect(parsed.results).toHaveLength(8);
        expect(parsed.results[0]).toEqual(valid);
        expect(parsed.results[1].subtitle).toBeNull();
    });
});

describe('map picker bridge: React Native -> WebView', () => {
    function runCommand(command: MapPickerCommand) {
        const run = jest.fn();
        const context = vm.createContext({ window: { __kezekMapPicker: { run } } });
        const value = vm.runInContext(buildMapPickerCommand(command), context);
        return { run, value };
    }

    test('the injected script hands the page the command as a JSON string', () => {
        const command: MapPickerCommand = { type: 'setPoint', lat: 42.87, lon: 74.6, address: 'Чуй, 120', source: 'search' };
        const { run, value } = runCommand(command);
        expect(value).toBe(true);
        expect(run).toHaveBeenCalledTimes(1);
        expect(JSON.parse(run.mock.calls[0][0])).toEqual(command);
    });

    test('a query is never evaluated as code', () => {
        const query = `"); window.hacked = true; ("</script>'\u2028`;
        const run = jest.fn();
        const window: Record<string, unknown> = { __kezekMapPicker: { run } };
        vm.runInContext(buildMapPickerCommand({ type: 'search', query }), vm.createContext({ window }));
        expect(window.hacked).toBeUndefined();
        expect(JSON.parse(run.mock.calls[0][0])).toEqual({ type: 'search', query });
    });

    test('does nothing before the page installed its handler', () => {
        const context = vm.createContext({ window: {} });
        expect(vm.runInContext(buildMapPickerCommand({ type: 'search', query: 'x' }), context)).toBe(true);
    });
});

describe('map picker state', () => {
    const start = initialMapPickerState({ point: { lat: 42.8, lon: 74.6 }, address: 'Старый адрес' });

    test('starts on the form point and address; ready and errors switch the status', () => {
        expect(start).toMatchObject({ status: 'loading', point: { lat: 42.8, lon: 74.6 }, address: 'Старый адрес' });
        expect(initialMapPickerState({ point: null, address: 'x' }).address).toBeNull();
        expect(mapPickerReducer(start, { type: 'ready' }).status).toBe('ready');
        const failed = mapPickerReducer(start, { type: 'error', reason: 'script' });
        expect(failed).toMatchObject({ status: 'error', errorReason: 'script' });
        expect(mapPickerReducer(failed, { type: 'reload' })).toMatchObject({ status: 'loading', errorReason: null });
    });

    test('a tap resolves the address; nothing is returned while resolving', () => {
        const resolving = mapPickerReducer(start, { type: 'resolving', lat: 42.9, lon: 74.7, source: 'tap' });
        expect(resolving).toMatchObject({ point: { lat: 42.9, lon: 74.7 }, address: null, resolving: true });
        expect(mapPickerResult(resolving)).toBeNull();
        const picked = mapPickerReducer(resolving, { type: 'pick', lat: 42.9, lon: 74.7, address: 'Новый адрес', geocodeFailed: false, source: 'tap' });
        expect(mapPickerResult(picked)).toEqual({ lat: 42.9, lon: 74.7, address: 'Новый адрес' });
    });

    test('a geocoder failure keeps the coordinates without an address', () => {
        const picked = mapPickerReducer(start, { type: 'pick', lat: 40.5, lon: 72.8, address: null, geocodeFailed: true, source: 'drag' });
        expect(picked.geocodeFailed).toBe(true);
        expect(mapPickerResult(picked)).toEqual({ lat: 40.5, lon: 72.8, address: null });
    });

    test('search results of an older query are dropped; choosing a result places the point', () => {
        let state = mapPickerReducer(start, { type: 'searchStart', query: 'Чуй' });
        state = mapPickerReducer(state, { type: 'searchStart', query: 'Чуй 120' });
        state = mapPickerReducer(state, { type: 'searchResults', query: 'Чуй', results: [] });
        expect(state.search.status).toBe('searching');
        const result = { lat: 42.87, lon: 74.61, title: 'проспект Чуй, 120', subtitle: 'Бишкек', address: null };
        state = mapPickerReducer(state, { type: 'searchResults', query: 'Чуй 120', results: [result] });
        expect(state.search).toEqual({ status: 'done', query: 'Чуй 120', results: [result] });
        state = mapPickerReducer(state, { type: 'chooseResult', result });
        expect(state.search.status).toBe('idle');
        expect(mapPickerResult(state)).toEqual({ lat: 42.87, lon: 74.61, address: 'проспект Чуй, 120' });
        expect(mapPickerReducer(mapPickerReducer(start, { type: 'searchStart', query: 'x' }), { type: 'searchError', query: 'x' }).search.status).toBe('error');
    });

    test('nothing to confirm before a point exists', () => {
        expect(mapPickerResult(initialMapPickerState({ point: null }))).toBeNull();
    });
});

describe('map picker start and configuration', () => {
    test('the form point wins, then the phone position, then the business city, then Bishkek', () => {
        const point = { lat: 42.1, lon: 74.2 };
        const user = { lat: 40.5, lon: 72.8 };
        expect(resolveMapPickerStart({ point, userLocation: user, city: 'Ош' })).toEqual({ center: point, zoom: 17, marker: true, city: null });
        expect(resolveMapPickerStart({ point: null, userLocation: user, city: 'Ош' })).toEqual({ center: user, zoom: 15, marker: false, city: null });
        expect(resolveMapPickerStart({ point: null, userLocation: null, city: ' Ош ' })).toEqual({ center: DEFAULT_MAP_CENTER, zoom: 12, marker: false, city: 'Ош' });
        expect(resolveMapPickerStart({ point: null })).toEqual({ center: DEFAULT_MAP_CENTER, zoom: 11, marker: false, city: null });
        expect(resolveMapPickerStart({ point: { lat: 120, lon: 0 } }).marker).toBe(false);
    });

    test('language and key', () => {
        expect(yandexMapsLang('en')).toBe('en_US');
        expect(yandexMapsLang('ru')).toBe('ru_RU');
        expect(yandexMapsLang('ky')).toBe('ru_RU');
        expect(resolveYandexMapsApiKey(' env-key ', 'extra-key')).toBe('env-key');
        expect(resolveYandexMapsApiKey(undefined, ' extra-key ')).toBe('extra-key');
        expect(resolveYandexMapsApiKey('', 42)).toBeNull();
        expect(resolveYandexMapsApiKey(undefined, undefined)).toBeNull();
    });
});

/* ===== the page script itself, against a fake Yandex Maps API ===== */

type Handler = (event: { get: (key: string) => unknown }) => void;

function fakeYmaps(geocode: (request: unknown, options: Record<string, unknown>) => Promise<unknown>) {
    const mapHandlers: Record<string, Handler> = {};
    const placemarks: { coords: number[]; handlers: Record<string, () => void> }[] = [];
    const maps: { center: number[]; zoom: number }[] = [];
    const geoObject = (coords: number[], props: Record<string, unknown>) => ({
        geometry: { getCoordinates: () => coords },
        properties: { get: (key: string) => props[key] },
    });
    const collection = (objects: ReturnType<typeof geoObject>[]) => ({
        geoObjects: { get: (i: number) => objects[i], each: (fn: (o: unknown) => void) => objects.forEach(fn) },
    });
    const api = {
        ready: (ok: () => void) => ok(),
        Map: function Map(this: Record<string, unknown>, _id: string, opts: { center: number[]; zoom: number }) {
            const state = { center: opts.center, zoom: opts.zoom };
            maps.push(state);
            this.events = { add: (type: string, cb: Handler) => { mapHandlers[type] = cb; } };
            this.geoObjects = { add: () => undefined };
            this.getZoom = () => state.zoom;
            this.getBounds = () => [[42, 74], [43, 75]];
            this.setCenter = (c: number[], z: number) => { state.center = c; state.zoom = z; };
        },
        Placemark: function Placemark(this: Record<string, unknown>, coords: number[]) {
            const mark = { coords, handlers: {} as Record<string, () => void> };
            placemarks.push(mark);
            this.geometry = { getCoordinates: () => mark.coords, setCoordinates: (c: number[]) => { mark.coords = c; } };
            this.events = { add: (type: string, cb: () => void) => { mark.handlers[type] = cb; } };
        },
        geocode: (request: unknown, options: Record<string, unknown>) => geocode(request, options),
    };
    return { api, mapHandlers, placemarks, maps, geoObject, collection };
}

function runPage(html: string, ymaps: ReturnType<typeof fakeYmaps>) {
    const posted: Record<string, unknown>[] = [];
    let script: Record<string, (() => void) | string | boolean> = {};
    const window: Record<string, unknown> = {
        ReactNativeWebView: { postMessage: (data: string) => posted.push(JSON.parse(data)) },
    };
    const context = vm.createContext({
        window,
        document: {
            createElement: () => (script = {}),
            head: { appendChild: () => undefined },
        },
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        encodeURIComponent,
        JSON,
        Math,
        String,
    });
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const code of scripts) vm.runInContext(code, context);
    const load = () => {
        window.ymaps = ymaps.api;
        (context as Record<string, unknown>).ymaps = ymaps.api;
        (script.onload as () => void)();
    };
    return { posted, window, script: () => script, load };
}

const last = <T,>(items: T[]): T => items[items.length - 1];
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('map picker page (mapPickerHtml)', () => {
    const base = {
        apiKey: 'key with space',
        lang: 'ru_RU' as const,
        background: '#0b1220',
        accent: '#6366f1',
        dark: true,
    };

    test('loads API 2.1 with the key, darkens the tiles and keeps config inert', () => {
        const html = buildMapPickerHtml({ ...base, start: resolveMapPickerStart({ point: null, city: '</script><script>alert(1)</script>' }) });
        expect(html).toContain('ground-pane');
        expect(html.match(/<\/script>/g)).toHaveLength(2);
        expect(buildMapPickerHtml({ ...base, dark: false, start: resolveMapPickerStart({ point: null }) })).not.toContain('ground-pane');
        expect(scriptSafeJson({ a: '</script>&' })).toBe('{"a":"\\u003c/script\\u003e\\u0026"}');

        const page = runPage(html, fakeYmaps(async () => ({ geoObjects: { get: () => undefined } })));
        expect(page.script().src).toBe('https://api-maps.yandex.ru/2.1/?apikey=key%20with%20space&lang=ru_RU');
    });

    test('a tap places the marker and posts the reverse-geocoded address', async () => {
        const ymaps = fakeYmaps(async (request) => (Array.isArray(request)
            ? ymaps.collection([ymaps.geoObject(request as number[], { metaDataProperty: { GeocoderMetaData: { text: 'Кыргызстан, Бишкек, проспект Чуй, 120' } } })])
            : ymaps.collection([])));
        const page = runPage(buildMapPickerHtml({ ...base, start: resolveMapPickerStart({ point: null }) }), ymaps);
        page.load();
        expect(page.posted).toEqual([{ type: 'ready', source: MAP_PICKER_SOURCE }]);
        expect(ymaps.maps[0]).toEqual({ center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lon], zoom: 11 });

        ymaps.mapHandlers.click({ get: () => [42.87, 74.61] });
        await flush();
        const events = page.posted.map((m) => parseMapPickerMessage(JSON.stringify(m)));
        expect(events.slice(1)).toEqual([
            { type: 'resolving', lat: 42.87, lon: 74.61, source: 'tap' },
            { type: 'pick', lat: 42.87, lon: 74.61, address: 'Кыргызстан, Бишкек, проспект Чуй, 120', geocodeFailed: false, source: 'tap' },
        ]);
        expect(ymaps.placemarks).toHaveLength(1);

        // Dragging the same marker resolves again.
        ymaps.placemarks[0].coords = [42.88, 74.62];
        ymaps.placemarks[0].handlers.dragend();
        await flush();
        expect(parseMapPickerMessage(JSON.stringify(last(page.posted)))).toMatchObject({ type: 'pick', lat: 42.88, lon: 74.62, source: 'drag' });
    });

    test('a geocoder failure still posts the coordinates', async () => {
        const ymaps = fakeYmaps(async () => { throw new Error('quota'); });
        const page = runPage(buildMapPickerHtml({ ...base, start: resolveMapPickerStart({ point: { lat: 42, lon: 74 } }) }), ymaps);
        page.load();
        expect(ymaps.placemarks).toHaveLength(1);
        ymaps.mapHandlers.click({ get: () => [42.5, 74.5] });
        await flush();
        expect(last(page.posted)).toMatchObject({ type: 'pick', lat: 42.5, lon: 74.5, address: null, geocodeFailed: true });
    });

    test('search and setPoint commands from React Native', async () => {
        const ymaps = fakeYmaps(async (request) => (typeof request === 'string'
            ? ymaps.collection([ymaps.geoObject([42.87, 74.61], { name: 'проспект Чуй, 120', description: 'Бишкек, Кыргызстан', text: 'Кыргызстан, Бишкек, проспект Чуй, 120' })])
            : ymaps.collection([])));
        const page = runPage(buildMapPickerHtml({ ...base, start: resolveMapPickerStart({ point: null }) }), ymaps);
        page.load();
        const run = (command: MapPickerCommand) => vm.runInContext(buildMapPickerCommand(command), vm.createContext({ window: page.window }));

        run({ type: 'search', query: 'Чуй 120' });
        await flush();
        expect(parseMapPickerMessage(JSON.stringify(last(page.posted)))).toEqual({
            type: 'searchResults',
            query: 'Чуй 120',
            results: [{ lat: 42.87, lon: 74.61, title: 'проспект Чуй, 120', subtitle: 'Бишкек, Кыргызстан', address: 'Кыргызстан, Бишкек, проспект Чуй, 120' }],
        });

        run({ type: 'setPoint', lat: 42.87, lon: 74.61, address: 'проспект Чуй, 120', source: 'search' });
        expect(last(page.posted)).toMatchObject({ type: 'pick', lat: 42.87, lon: 74.61, address: 'проспект Чуй, 120', from: 'search' });
        expect(ymaps.maps[0].center).toEqual([42.87, 74.61]);
        expect(ymaps.maps[0].zoom).toBe(16);
    });

    test('a script that fails to load is reported', () => {
        const page = runPage(buildMapPickerHtml({ ...base, start: resolveMapPickerStart({ point: null }) }), fakeYmaps(async () => null));
        (page.script().onerror as () => void)();
        expect(page.posted).toEqual([{ type: 'error', reason: 'script', source: MAP_PICKER_SOURCE }]);
    });
});

describe('branch form wiring of the picker', () => {
    test('the picker opens on valid form coordinates only', () => {
        expect(mapPickerPointFrom({ lat: '42,8746', lon: ' 74.5698 ' })).toEqual({ lat: 42.8746, lon: 74.5698 });
        expect(mapPickerPointFrom({ lat: '', lon: '' })).toBeNull();
        expect(mapPickerPointFrom({ lat: '42', lon: '' })).toBeNull();
        expect(mapPickerPointFrom({ lat: '100', lon: '74' })).toBeNull();
    });

    test('a pick fills coordinates and the found address; without one the typed address stays', () => {
        const form = { ...NEW_BRANCH_FORM, name: 'Центр', address: 'Как ввели' };
        expect(applyMapPick(form, { lat: 42.874612345, lon: 74.5698, address: ' Бишкек, Чуй 120 ' }))
            .toEqual({ ...form, lat: '42.874612', lon: '74.569800', address: 'Бишкек, Чуй 120' });
        expect(applyMapPick(form, { lat: 40.5, lon: 72.8, address: null }))
            .toEqual({ ...form, lat: '40.500000', lon: '72.800000', address: 'Как ввели' });
    });
});
