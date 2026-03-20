import { useEffect, useState } from 'react';

type UseSlotsRefreshKeyArgs = {
    serviceId: string;
    staffId: string;
    dayStr: string;
};

export function useSlotsRefreshKey({ serviceId, staffId, dayStr }: UseSlotsRefreshKeyArgs) {
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);

    useEffect(() => {
        let lastUpdate = 0;

        const handleVisibilityChange = () => {
            const now = Date.now();
            if (now - lastUpdate < 2000) return;

            if (document.visibilityState === 'visible' && serviceId && staffId && dayStr) {
                lastUpdate = now;
                setSlotsRefreshKey((current) => current + 1);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [serviceId, staffId, dayStr]);

    const bumpSlotsRefreshKey = () => {
        setSlotsRefreshKey((current) => current + 1);
    };

    return {
        slotsRefreshKey,
        bumpSlotsRefreshKey,
    };
}
