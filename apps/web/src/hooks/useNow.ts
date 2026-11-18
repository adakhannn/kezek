import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` while the component is mounted. Screens that
 * compare data with "now" (bookings that have started, overdue items) stay correct when they
 * are left open; a value captured once at mount froze them (FE-14).
 */
export function useNow(intervalMs = 60_000): Date {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);

    return now;
}
