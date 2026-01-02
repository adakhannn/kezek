import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import Link from 'next/link';

import './globals.css';
import {AuthStatusServer} from './_components/AuthStatusServer';
import {AuthStatusUpdater} from './_components/AuthStatusWrapper';
import {NameReminderBanner} from './_components/NameReminderBanner';

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
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ru">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                            <span className="relative text-2xl font-bold gradient-text">Kezek</span>
                        </div>
                    </Link>
                    <AuthStatusServer/>
                    <AuthStatusUpdater/>
                </div>
            </div>
        </header>

        <NameReminderBanner />

        {children}
        
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
        </body>
        </html>
    );
}
