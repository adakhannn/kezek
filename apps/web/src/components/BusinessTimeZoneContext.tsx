'use client';

import { DEFAULT_BUSINESS_TIME_ZONE, resolveBusinessTimeZone } from '@shared-client/timezone';
import { createContext, useContext, type ReactNode } from 'react';

const BusinessTimeZoneContext = createContext<string>(DEFAULT_BUSINESS_TIME_ZONE);

/**
 * The time zone of the business on screen (`businesses.tz`, ARCH-11). The business and staff cabinets
 * provide it from their layouts; outside them (or with NULL/unknown tz) it is Asia/Bishkek.
 */
export function useBusinessTimeZone(): string {
    return useContext(BusinessTimeZoneContext);
}

export function BusinessTimeZoneProvider({ timeZone, children }: { timeZone: string | null | undefined; children: ReactNode }) {
    return (
        <BusinessTimeZoneContext.Provider value={resolveBusinessTimeZone(timeZone)}>
            {children}
        </BusinessTimeZoneContext.Provider>
    );
}
