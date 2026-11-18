import { GET } from '@/app/.well-known/assetlinks.json/route';
import { androidAssetLinks } from '@/lib/androidAssetLinks';

const FINGERPRINT = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');

describe('/.well-known/assetlinks.json (MOB-05)', () => {
    const original = process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS;
    afterEach(() => {
        if (original === undefined) delete process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS;
        else process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS = original;
    });

    test('is absent until a signing fingerprint is configured', async () => {
        delete process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS;
        expect(GET().status).toBe(404);
        process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS = 'not-a-fingerprint';
        expect(GET().status).toBe(404);
    });

    test('names the app package and every configured fingerprint', async () => {
        process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS = ` ${FINGERPRINT.toLowerCase()} , ${FINGERPRINT}`;
        const response = GET();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([{
            relation: ['delegate_permission/common.handle_all_urls'],
            target: { namespace: 'android_app', package_name: 'kg.kezek.app', sha256_cert_fingerprints: [FINGERPRINT, FINGERPRINT] },
        }]);
    });

    test('one malformed fingerprint disables the file instead of publishing a partial list', () => {
        expect(androidAssetLinks(`${FINGERPRINT},AB:CD`)).toBeNull();
    });
});
