import { normalizeDirectoryLink, sanitizeDirectoryLinks, validateDirectoryLinks } from '@/lib/directoryLinks';

describe('directoryLinks', () => {
    test.each([
        ['instagram', 'https://www.instagram.com/kezek.salon/', 'https://www.instagram.com/kezek.salon/'],
        ['instagram', 'instagram.com/kezek.salon', 'https://instagram.com/kezek.salon'],
        ['instagram', 'http://instagr.am/kezek', 'https://instagr.am/kezek'],
        ['two_gis', 'https://2gis.kg/bishkek/firm/70000001012345678', 'https://2gis.kg/bishkek/firm/70000001012345678'],
        ['two_gis', 'https://go.2gis.com/abc12', 'https://go.2gis.com/abc12'],
        ['google_maps', 'https://maps.app.goo.gl/AbCdEf', 'https://maps.app.goo.gl/AbCdEf'],
        ['google_maps', 'https://www.google.com/maps/place/Bishkek', 'https://www.google.com/maps/place/Bishkek'],
        ['google_maps', 'https://maps.google.kg/?q=42.87,74.59', 'https://maps.google.kg/?q=42.87,74.59'],
        ['yandex_maps', 'https://yandex.kg/maps/-/CDabcXYZ', 'https://yandex.kg/maps/-/CDabcXYZ'],
        ['yandex_maps', 'https://yandex.ru/maps/org/kezek/1234567890/', 'https://yandex.ru/maps/org/kezek/1234567890/'],
        ['yandex_maps', 'https://ya.cc/t/AbCd', 'https://ya.cc/t/AbCd'],
    ] as const)('accepts %s link %s', (key, input, expected) => {
        expect(normalizeDirectoryLink(key, input)).toEqual({ ok: true, value: expected });
    });

    test.each([
        ['two_gis', 'https://kezek.kg/'],
        ['instagram', 'https://instagram.com.evil.kg/profile'],
        ['instagram', 'https://evilinstagram.com/profile'],
        ['google_maps', 'https://google.evil.com/maps'],
        ['yandex_maps', 'https://maps.yandex.ru.example.com/'],
        ['instagram', 'javascript:alert(1)'],
        ['instagram', 'data:text/html,hi'],
        ['instagram', 'https://user:secret@instagram.com/'],
        ['two_gis', 'https://2gis.kg:8443/firm/1'],
        ['google_maps', 'https://2gis.kg/firm/1'],
    ] as const)('rejects %s link %s', (key, input) => {
        expect(normalizeDirectoryLink(key, input)).toEqual({ ok: false });
    });

    test('treats empty values as no link and rejects non-strings', () => {
        expect(normalizeDirectoryLink('instagram', null)).toEqual({ ok: true, value: null });
        expect(normalizeDirectoryLink('instagram', '   ')).toEqual({ ok: true, value: null });
        expect(normalizeDirectoryLink('instagram', 42)).toEqual({ ok: false });
        expect(normalizeDirectoryLink('instagram', `https://instagram.com/${'a'.repeat(2048)}`)).toEqual({ ok: false });
    });

    test('validation names every service with a foreign link and drops unknown keys', () => {
        expect(validateDirectoryLinks({
            instagram: 'https://instagram.com/salon',
            two_gis: 'https://kezek.kg/',
            yandex_maps: 'https://kezek.kg/',
            tiktok: 'https://tiktok.com/@salon',
        })).toEqual({
            ok: false,
            invalid: ['two_gis', 'yandex_maps'],
            message: 'Ссылка должна вести на сайт своего сервиса: 2ГИС, Яндекс Карты',
        });
        expect(validateDirectoryLinks({ instagram: ' instagram.com/salon ' })).toEqual({
            ok: true,
            value: { instagram: 'https://instagram.com/salon', two_gis: null, google_maps: null, yandex_maps: null },
        });
        expect(validateDirectoryLinks(null)).toEqual({
            ok: true,
            value: { instagram: null, two_gis: null, google_maps: null, yandex_maps: null },
        });
    });

    test('sanitizing keeps only links that lead to their own service', () => {
        expect(sanitizeDirectoryLinks({
            instagram: 'https://kezek.kg/',
            two_gis: 'https://kezek.kg/',
            google_maps: 'https://maps.app.goo.gl/AbCdEf',
            yandex_maps: 'not a url at all',
        })).toEqual({ instagram: null, two_gis: null, google_maps: 'https://maps.app.goo.gl/AbCdEf', yandex_maps: null });
        expect(sanitizeDirectoryLinks('https://instagram.com/x')).toEqual({ instagram: null, two_gis: null, google_maps: null, yandex_maps: null });
    });
});
