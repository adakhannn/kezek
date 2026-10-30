// apps/web/src/app/cabinet/components/MapDialog.tsx
'use client';

import { useEffect, useRef } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Dialog } from '@/components/ui/Dialog';
import { loadYandexMaps } from '@/lib/yamaps';

export default function MapDialog({
                                      open, onClose, lat, lon, title, address,
                                  }: {
    open: boolean; onClose: () => void;
    lat: number | null; lon: number | null;
    title?: string; address?: string | null;
}) {
    const { t } = useLanguage();
    const boxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        let destroyed = false;

        (async () => {
            const ymaps = await loadYandexMaps();
            if (destroyed || !boxRef.current) return;

            const center = (lat && lon) ? [lat, lon] : [42.8746, 74.5698]; // Бишкек как дефолт
            const map = new ymaps.Map(boxRef.current, { center, zoom: (lat && lon) ? 16 : 11, controls: [] });
            const zoom = new ymaps.control.ZoomControl({ options: { size: 'small', position: { right: 10, top: 10 } }});
            map.controls.add(zoom);

            if (lat && lon) {
                const pm = new ymaps.Placemark([lat, lon], { balloonContent: address || title || '' });
                map.geoObjects.add(pm);
            }
        })();

        return () => { destroyed = true; };
    }, [open, lat, lon, address, title]);

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title || t('cabinet.map.title', 'Карта')}
            description={address || undefined}
            size="lg"
        >
            <div ref={boxRef} className="h-80 rounded border" />
        </Dialog>
    );
}
