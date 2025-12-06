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
        <div className="border rounded p-3 text-sm bg-green-50 border-green-300 text-green-900">
            {text}
        </div>
    );
}
