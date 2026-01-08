import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import Link from 'next/link';

import './globals.css';
import {AuthStatusServer} from './_components/AuthStatusServer';
import {AuthStatusUpdater} from './_components/AuthStatusWrapper';
import {Logo} from './_components/Logo';
import {MobileHeaderMenu} from './_components/MobileHeaderMenu';
import {ReminderBanners} from './_components/ReminderBanners';
import {LanguageProvider} from './_components/i18n/LanguageProvider';
import {LanguageSwitcher} from './_components/i18n/LanguageSwitcher';

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
        <LanguageProvider>
            <div className="flex flex-col min-h-screen">
                <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm">
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
                
                <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                © {new Date().getFullYear()} Kezek. Все права защищены.
                            </p>
                            <div className="flex items-center gap-6 flex-wrap">
                                <Link 
                                    href="/privacy" 
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    Политика конфиденциальности
                                </Link>
                                <Link
                                    href="/terms"
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    Пользовательское соглашение
                                </Link>
                                <Link
                                    href="/data-deletion"
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    Удаление данных
                                </Link>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </LanguageProvider>
        </body>
        </html>
    );
}
