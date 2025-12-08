'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FlashBanner({
                                        showInitially,
                                        text,
                                        clearQueryKey = 'dismissed',
                                        ms = 3000,
                                    }: {
    showInitially: boolean;
    text: string;
    clearQueryKey?: string;
    ms?: number;
}) {
    const r = useRouter();
    const pathname = usePathname();
    const [show, setShow] = useState(showInitially);

    // Сразу очищаем query-параметр в адресной строке, но баннер оставляем на экране на ms мс
    useEffect(() => {
        if (!showInitially) return;
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete(clearQueryKey);
            const qs = url.searchParams.toString();
            r.replace(pathname + (qs ? `?${qs}` : ''));
        } catch (e) {
            // Не критично, если не удалось обновить URL - это только UX улучшение
            console.warn('[FlashBanner] Failed to update URL:', e instanceof Error ? e.message : String(e));
        }
        const t = setTimeout(() => setShow(false), ms);
        return () => clearTimeout(t);
    }, [showInitially, clearQueryKey, ms, pathname, r]);

    if (!show) return null;
    return (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-md animate-fade-in">
            <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">{text}</p>
            </div>
        </div>
    );
}
