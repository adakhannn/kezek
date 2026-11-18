'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * Висящее уведомление, напоминающее пользователю заполнить имя. Показывать ли его, решает сервер
 * (ReminderBanners); внутри личного кабинета, где имя и заполняют, баннер скрыт.
 */
export function NameReminderBanner() {
    const pathname = usePathname();
    if (pathname === '/cabinet' || pathname.startsWith('/cabinet/')) return null;
    return <DismissibleNameReminderBanner key={pathname} />;
}

function DismissibleNameReminderBanner() {
    const [show, setShow] = useState(true);
    if (!show) return null;

    return (
        <div className="sticky top-14 sm:top-16 z-[99] bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">
                            Пожалуйста, заполните ваше имя в профиле для лучшего опыта использования сервиса.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/cabinet"
                            className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
                        >
                            Заполнить профиль
                        </Link>
                        <button
                            onClick={() => setShow(false)}
                            className="text-white/80 hover:text-white transition-colors"
                            aria-label="Закрыть"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

