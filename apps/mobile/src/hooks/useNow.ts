import { useCallback, useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` while mounted, plus `refresh` for an explicit
 * update (pull to refresh). A value captured once at mount kept finished bookings among the
 * upcoming ones for as long as the screen stayed open (FE-14).
 */
export function useNow(intervalMs = 60_000): { now: Date; refresh: () => void } {
    const [now, setNow] = useState(() => new Date());
    const refresh = useCallback(() => setNow(new Date()), []);

    useEffect(() => {
        const id = setInterval(refresh, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs, refresh]);

    return { now, refresh };
}
