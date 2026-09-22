import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const localTunnelHost = process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_PUBLIC_ORIGIN
    ? new URL(process.env.LOCAL_AUTH_PUBLIC_ORIGIN).hostname
    : null;

/**
 * Security Headers для защиты от XSS, clickjacking, MIME sniffing и других атак
 */
const securityHeaders = [
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
    },
    {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    },
    {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    },
    {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin'
    },
    {
        key: 'Permissions-Policy',
        // geolocation=(self) — разрешаем запрос геолокации на странице карты («Ближайший ко мне»)
        value: 'camera=(), microphone=(), geolocation=(self)'
    },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            // Yandex Maps грузит доп. бандл с yastatic.net, поэтому добавляем его в script-src
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api-maps.yandex.ru https://yandex.ru https://yastatic.net https://telegram.org",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' https://*.supabase.co https://graph.facebook.com https://api.telegram.org https://log.api-maps.yandex.ru wss://*.supabase.co https://*.ingest.sentry.io https://*.sentry.io",
            "frame-src 'self' https://www.google.com https://yandex.ru https://oauth.telegram.org",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
            "upgrade-insecure-requests",
        ].join('; ')
    }
];

const nextConfig: NextConfig = {
    // Разрешаем dev-ресурсы только для текущего временного HTTPS-туннеля.
    allowedDevOrigins: localTunnelHost ? [localTunnelHost] : [],
    // Билд должен падать при ошибках типов
    typescript: { ignoreBuildErrors: false },

    // /favicon.ico отдаём нашу иконку (icon-192.png), а не дефолтную от Vercel/Next
    async rewrites() {
        return [{ source: '/favicon.ico', destination: '/icon-192.png' }];
    },
    
    // Оптимизации для bundle size
    compiler: {
        // Удаляем console.log в production
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },
    
    // Экспериментальные оптимизации
    experimental: {
        optimizePackageImports: [
            'date-fns',
            'date-fns-tz',
            'lucide-react',
            '@tanstack/react-query',
        ],
    },
    
    // Добавляем Security Headers ко всем ответам
    async headers() {
        return [
            {
                // Применяем ко всем путям
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};

const sentryConfig = {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    authToken: process.env.SENTRY_AUTH_TOKEN,
};

export default withSentryConfig(nextConfig, sentryConfig);
