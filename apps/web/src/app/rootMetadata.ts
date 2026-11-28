import type { Metadata } from 'next';

import { getT } from './_components/i18n/server';

type Locale = 'ru' | 'ky' | 'en';

/**
 * The site-wide default metadata in the visitor's language: pages without their own title
 * (404, a booking while it loads, ...) show the home page's title, never an English default on a
 * Russian or Kyrgyz page.
 */
export function rootMetadata(locale: Locale): Metadata {
    const t = getT(locale);
    return {
        title: t('home.seo.title'),
        description: t('home.seo.description'),
        manifest: '/manifest.webmanifest',
        icons: [
            { rel: 'icon', url: '/icon-192.png' },
            { rel: 'apple-touch-icon', url: '/icon-192.png' },
        ],
        other: {
            'facebook-domain-verification': 'g5lm3sbfqpeijkt93lqgoxg65tqlz3',
        },
    };
}
