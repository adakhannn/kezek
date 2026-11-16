import type { MetadataRoute } from 'next';

import { getPublicSiteOrigin } from '@/lib/siteOrigin';

/** The sitemaps protocol requires an absolute sitemap URL. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api', '/auth', '/cabinet', '/dashboard', '/staff', '/select-business', '/select-cabinet'],
        },
        sitemap: `${getPublicSiteOrigin()}/sitemap.xml`,
    };
}
