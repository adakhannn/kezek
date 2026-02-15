import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';

import './globals.css';
import {AuthStatusServer} from './_components/AuthStatusServer';
import {AuthStatusUpdater} from './_components/AuthStatusWrapper';
import {Footer} from './_components/Footer';
import {Logo} from './_components/Logo';
import {MobileHeaderMenu} from './_components/MobileHeaderMenu';
import {ReminderBanners} from './_components/ReminderBanners';
import {LanguageProvider} from './_components/i18n/LanguageProvider';
import {LanguageSwitcher} from './_components/i18n/LanguageSwitcher';

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
    title: 'Kezek — бронирование в Оше',
    description: 'Быстрая запись в сервисы города Ош',
    manifest: '/manifest.webmanifest',
    icons: [
        {rel: 'icon', url: '/icon-192.png'},
        {rel: 'apple-touch-icon', url: '/icon-192.png'},
    ],
    other: {
        'facebook-domain-verification': 'g5lm3sbfqpeijkt93lqgoxg65tqlz3',
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ky">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>
        <PerformanceTracking />
        <ReactQueryProvider>
        <LanguageProvider>
            <div className="flex flex-col min-h-screen">
                <header className="sticky top-0 z-[100] border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm">
                    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
                        <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4">
                            {/* Логотип - с ограничением ширины на мобильных, центрируется */}
                            <div className="flex-1 md:flex-none min-w-0 flex justify-center md:justify-start">
                                <Logo />
                            </div>
                            {/* Десктопная версия - показываем на md и выше */}
                            <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-auto">
                                <LanguageSwitcher />
                                <AuthStatusServer/>
                            </div>
                            {/* Мобильная версия - показываем только на md и ниже */}
                            <div className="md:hidden relative flex-shrink-0">
                                <MobileHeaderMenu />
                            </div>
                            <AuthStatusUpdater/>
                        </div>
                    </div>
                </header>

                <ReminderBanners />

                <main className="flex-1">
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
