import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import Link from 'next/link';

import './globals.css';
import {AuthStatusServer} from './_components/AuthStatusServer';

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
    description: 'Быстрая запись в барбершопы и сервисы города Ош',
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
        <header className="border-b">
            <div className="mx-auto max-w-6xl p-4 flex items-center justify-between">
                <Link href="/" className="font-semibold">Kezek</Link>
                <AuthStatusServer/>
            </div>
        </header>

        {children}
        </body>
        </html>
    );
}
