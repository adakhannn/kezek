import { getBaseUrl } from '@/lib/seo';
import { DEFAULT_SITE_ORIGIN, getPublicSiteHost, getPublicSiteOrigin } from '@/lib/siteOrigin';

describe('public site origin', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = originalEnv;
    });

    it('defaults to a domain the project controls, never the lost kezek.kg', () => {
        process.env = { ...originalEnv };
        delete process.env.NEXT_PUBLIC_SITE_ORIGIN;

        expect(getPublicSiteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
        expect(getPublicSiteHost()).toBe('kezek.vercel.app');
        expect(getBaseUrl()).toBe(DEFAULT_SITE_ORIGIN);
        expect(DEFAULT_SITE_ORIGIN).not.toContain('kezek.kg');
    });

    it('normalises the configured origin', () => {
        process.env = { ...originalEnv, NEXT_PUBLIC_SITE_ORIGIN: ' https://example.test/some/path/ ' };

        expect(getPublicSiteOrigin()).toBe('https://example.test');
        expect(getPublicSiteHost()).toBe('example.test');
        expect(getBaseUrl()).toBe('https://example.test');
    });

    it('falls back to the default when the configured value is malformed', () => {
        process.env = { ...originalEnv, NEXT_PUBLIC_SITE_ORIGIN: 'not a url' };

        expect(getPublicSiteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
    });
});
