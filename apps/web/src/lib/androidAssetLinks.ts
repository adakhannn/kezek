// Android App Links (MOB-05). Android opens https://kezek.vercel.app links in the Kezek app, instead
// of the browser, only when /.well-known/assetlinks.json names the app's package and the SHA-256
// fingerprint of the certificate it is signed with. The fingerprint belongs to the signing key
// (EAS: `eas credentials`), so it is configuration: ANDROID_APP_LINK_SHA256_FINGERPRINTS, a
// comma-separated list such as "AB:CD:...:EF". Until it is set the file is absent and links keep
// opening in the browser.
export const ANDROID_PACKAGE = 'kg.kezek.app';
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export type AssetLinkStatement = {
    relation: string[];
    target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] };
};

/** The assetlinks.json statements, or null when no valid fingerprint is configured. */
export function androidAssetLinks(configured: string | undefined): AssetLinkStatement[] | null {
    const fingerprints = (configured ?? '')
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
    if (fingerprints.length === 0 || fingerprints.some((value) => !FINGERPRINT.test(value))) return null;
    return [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    }];
}
