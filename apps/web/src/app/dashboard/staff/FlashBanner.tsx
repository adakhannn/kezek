'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';

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
        } catch {}
        const t = setTimeout(() => setShow(false), ms);
        return () => clearTimeout(t);
    }, [showInitially, clearQueryKey, ms, pathname, r]);

    if (!show) return null;
    return <AlertBanner variant="success" message={text} compact />;
}
