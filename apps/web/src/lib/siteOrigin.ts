/**
 * Public production origin. kezek.kg was lost to a third party in November 2026,
 * so it must never appear as a default: links in notifications, magic links,
 * alerts, SEO metadata and legal pages are built from this value. Override it
 * with NEXT_PUBLIC_SITE_ORIGIN once the project owns a custom domain again.
 */
export const DEFAULT_SITE_ORIGIN = 'https://kezek.vercel.app';

/**
 * Normalised public origin (no trailing slash or path). Safe in client
 * components: the env reference is static, so Next.js inlines it at build time.
 * A malformed value falls back to the default instead of breaking rendering.
 */
export function getPublicSiteOrigin(): string {
    const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim();
    try {
        return new URL(configured || DEFAULT_SITE_ORIGIN).origin;
    } catch {
        return DEFAULT_SITE_ORIGIN;
    }
}

/** Host for display, e.g. "kezek.vercel.app". */
export function getPublicSiteHost(): string {
    return new URL(getPublicSiteOrigin()).host;
}
