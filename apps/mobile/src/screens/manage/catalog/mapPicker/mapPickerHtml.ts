import { MAP_PICKER_SOURCE, type MapPickerStart } from './mapPickerBridge';

export type MapPickerPageConfig = {
    apiKey: string;
    lang: 'ru_RU' | 'en_US';
    start: MapPickerStart;
    /** Page background behind the tiles while they load (the app's page surface). */
    background: string;
    /** Marker fill (the app's accent). */
    accent: string;
    /** Darken the map tiles to match the app's dark theme. */
    dark: boolean;
    /** Milliseconds before a map that never became ready is reported as failed. */
    timeoutMs?: number;
};

/** JSON safe to place inside an inline <script>: no "</script>", no HTML comment openers. */
export function scriptSafeJson(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .split(String.fromCharCode(0x2028)).join('\\u2028')
        .split(String.fromCharCode(0x2029)).join('\\u2029');
}

function markerSvg(accent: string): string {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">' +
        `<path d="M22 54s18-17.4 18-31A18 18 0 0 0 4 23c0 13.6 18 31 18 31z" fill="${accent}" stroke="#ffffff" stroke-width="3"/>` +
        '<circle cx="22" cy="23" r="7" fill="#ffffff"/></svg>';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* The page script. ES5 on purpose: it runs in whatever system WebView the phone has. */
const PAGE_SCRIPT = `
(function () {
    var C = window.__KEZEK_MAP_PICKER_CONFIG__;
    var failed = false;
    var map = null;
    var mark = null;
    var seq = 0;

    function post(message) {
        message.source = C.tag;
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
    function fail(reason) {
        if (failed || map) return;
        failed = true;
        post({ type: 'error', reason: reason });
    }
    var timer = setTimeout(function () { fail('timeout'); }, C.timeoutMs);

    function addressOf(obj) {
        if (!obj) return null;
        try {
            var line = obj.getAddressLine && obj.getAddressLine();
            if (line) return line;
            var meta = obj.properties.get('metaDataProperty');
            var text = meta && meta.GeocoderMetaData && meta.GeocoderMetaData.text;
            return text || obj.properties.get('text') || obj.properties.get('name') || null;
        } catch (e) {
            return null;
        }
    }

    function place(coords) {
        if (!mark) {
            mark = new ymaps.Placemark(coords, {}, {
                draggable: true,
                iconLayout: 'default#image',
                iconImageHref: C.marker,
                iconImageSize: [44, 56],
                iconImageOffset: [-22, -54]
            });
            mark.events.add('dragend', function () { resolve(mark.geometry.getCoordinates(), 'drag'); });
            map.geoObjects.add(mark);
        } else {
            mark.geometry.setCoordinates(coords);
        }
    }

    function emit(coords, address, geocodeFailed, from) {
        post({ type: 'pick', lat: coords[0], lon: coords[1], address: address, geocodeFailed: geocodeFailed, from: from });
    }

    // Reverse geocoding as on the website: the house first, then the nearest named object.
    function resolve(coords, from) {
        var id = ++seq;
        post({ type: 'resolving', lat: coords[0], lon: coords[1], from: from });
        function onFail() { if (id === seq) emit(coords, null, true, from); }
        ymaps.geocode(coords, { kind: 'house', results: 1 }).then(function (res) {
            if (id !== seq) return;
            var address = addressOf(res.geoObjects.get(0));
            if (address) return emit(coords, address, false, from);
            ymaps.geocode(coords, { results: 1 }).then(function (any) {
                if (id === seq) emit(coords, addressOf(any.geoObjects.get(0)), false, from);
            }, onFail);
        }, onFail);
    }

    function search(query) {
        var options = { results: 8 };
        try { options.boundedBy = map.getBounds(); } catch (e) {}
        ymaps.geocode(query, options).then(function (res) {
            var results = [];
            res.geoObjects.each(function (obj) {
                var c = obj.geometry.getCoordinates();
                results.push({
                    lat: c[0],
                    lon: c[1],
                    title: obj.properties.get('name') || addressOf(obj),
                    subtitle: obj.properties.get('description') || null,
                    address: addressOf(obj)
                });
            });
            post({ type: 'searchResults', query: query, results: results });
        }, function () {
            post({ type: 'searchError', query: query });
        });
    }

    window.__kezekMapPicker = {
        run: function (json) {
            if (!map) return;
            var cmd;
            try { cmd = JSON.parse(json); } catch (e) { return; }
            if (cmd.type === 'setPoint') {
                var coords = [cmd.lat, cmd.lon];
                place(coords);
                map.setCenter(coords, Math.max(map.getZoom(), 16), { duration: 300 });
                if (cmd.address) { seq++; emit(coords, cmd.address, false, cmd.source); }
                else resolve(coords, cmd.source);
            } else if (cmd.type === 'search' && cmd.query) {
                search(String(cmd.query));
            }
        }
    };

    function init() {
        clearTimeout(timer);
        if (failed) return;
        try {
            map = new ymaps.Map('map', {
                center: [C.start.center.lat, C.start.center.lon],
                zoom: C.start.zoom,
                controls: []
            }, {
                suppressMapOpenBlock: true,
                yandexMapDisablePoiInteractivity: true
            });
            map.events.add('click', function (e) {
                var coords = e.get('coords');
                if (!coords || coords.length < 2) return;
                place(coords);
                resolve(coords, 'tap');
            });
            if (C.start.marker) place([C.start.center.lat, C.start.center.lon]);
            if (!C.start.marker && C.start.city) {
                ymaps.geocode(C.start.city, { results: 1 }).then(function (res) {
                    var obj = res.geoObjects.get(0);
                    if (obj && !mark) map.setCenter(obj.geometry.getCoordinates(), 12, { duration: 200 });
                }, function () {});
            }
            post({ type: 'ready' });
        } catch (e) {
            map = null;
            fail('init');
        }
    }

    var script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=' + encodeURIComponent(C.apiKey) + '&lang=' + C.lang;
    script.async = true;
    script.onerror = function () { clearTimeout(timer); fail('script'); };
    script.onload = function () {
        if (!window.ymaps) { clearTimeout(timer); return fail('script'); }
        window.ymaps.ready(init, function () { clearTimeout(timer); fail('init'); });
    };
    document.head.appendChild(script);
})();
`;

/**
 * The picker page: a full-bleed Yandex map (JS API 2.1, the website's version and key), the
 * app's own marker, darkened tiles. Search, address and buttons are native, above the WebView.
 */
export function buildMapPickerHtml(config: MapPickerPageConfig): string {
    const pageConfig = {
        tag: MAP_PICKER_SOURCE,
        apiKey: config.apiKey,
        lang: config.lang,
        start: config.start,
        marker: markerSvg(config.accent),
        timeoutMs: config.timeoutMs ?? 20000,
    };
    // Yandex has no dark scheme in API 2.1: the tile layer is inverted and re-hued, the marker is not.
    const darkCss = config.dark
        ? '[class*="ground-pane"]{filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.55);}'
        : '';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${config.background};}
body{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
${darkCss}
</style>
</head>
<body>
<div id="map"></div>
<script>window.__KEZEK_MAP_PICKER_CONFIG__ = ${scriptSafeJson(pageConfig)};</script>
<script>${PAGE_SCRIPT}</script>
</body>
</html>`;
}
