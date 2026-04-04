import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';

import './globals.css';
import {AppShellHeader} from './_components/AppShellHeader';
import {AuthStatusUpdater} from './_components/AuthStatusWrapper';
import {Footer} from './_components/Footer';
import {ReminderBanners} from './_components/ReminderBanners';
import {LanguageProvider} from './_components/i18n/LanguageProvider';
import {getServerLocale} from './_components/i18n/server';

import {ErrorBoundary} from '@/components/ErrorBoundary';
import {PerformanceTracking} from '@/components/PerformanceTracking';
import {ReactQueryProvider} from '@/lib/react-query';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Kezek вЂ” Р±СЂРѕРЅРёСЂРѕРІР°РЅРёРµ РІ РћС€Рµ',
    description: 'Р‘С‹СЃС‚СЂР°СЏ Р·Р°РїРёСЃСЊ РІ СЃРµСЂРІРёСЃС‹ РіРѕСЂРѕРґР° РћС€',
    manifest: '/manifest.webmanifest',
    icons: [
        {rel: 'icon', url: '/icon-192.png'},
        {rel: 'apple-touch-icon', url: '/icon-192.png'},
    ],
    other: {
        'facebook-domain-verification': 'g5lm3sbfqpeijkt93lqgoxg65tqlz3',
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const locale = await getServerLocale();

    return (
        <html lang={locale}>
            <body className={`${geistSans.variable} ${geistMono.variable} bg-[var(--surface-base)] text-[var(--text-primary)] antialiased`}>
                <ErrorBoundary>
                    <PerformanceTracking />
                    <ReactQueryProvider>
                        <LanguageProvider>
                            <div className="relative flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.1),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-base)_92%,white)_0%,var(--surface-base)_42%,var(--surface-base)_100%)]">
                                <AppShellHeader />
                                <AuthStatusUpdater />

                                <ReminderBanners />

                                <main className="relative flex-1">
                                    {children}
                                </main>

                                <Footer />
                            </div>
                        </LanguageProvider>
                    </ReactQueryProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
