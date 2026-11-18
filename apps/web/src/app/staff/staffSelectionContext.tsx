'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { STAFF_SELECTION_SIGNAL } from '@/lib/staffSelection';

const StaffSelectionContext = createContext<string | null>(null);

// The card this tab itself announced: its own message must not reload it.
let ownAnnouncement: string | null = null;

/** The staff card this tab acts as (ARCH-02); null outside the staff cabinet. */
export function useSelectedStaffId(): string | null {
    return useContext(StaffSelectionContext);
}

/** Tells the other tabs of this browser that the chosen staff card changed. */
export function announceStaffSelection(staffId: string) {
    ownAnnouncement = staffId;
    try {
        const channel = new BroadcastChannel(STAFF_SELECTION_SIGNAL);
        channel.postMessage(staffId);
        channel.close();
    } catch {
        // No BroadcastChannel: the storage event below still reaches other tabs.
    }
    try {
        window.localStorage.setItem(STAFF_SELECTION_SIGNAL, `${staffId}:${Date.now()}`);
    } catch {
        // Storage blocked: other tabs keep acting as their own card (requests carry it).
    }
}

/**
 * Provides the card on screen to the cabinet's requests and reloads this tab when another tab
 * chooses a different card, so that a tab never shows one business and acts in another.
 */
export function StaffSelectionProvider({ staffId, children }: { staffId: string; children: ReactNode }) {
    useEffect(() => {
        const onChosen = (chosen: unknown) => {
            if (typeof chosen !== 'string' || !chosen || chosen === staffId || chosen === ownAnnouncement) return;
            window.location.reload();
        };
        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel(STAFF_SELECTION_SIGNAL);
            channel.onmessage = (event) => onChosen(event.data);
        } catch {
            channel = null;
        }
        const onStorage = (event: StorageEvent) => {
            if (event.key === STAFF_SELECTION_SIGNAL && event.newValue) onChosen(event.newValue.split(':')[0]);
        };
        window.addEventListener('storage', onStorage);
        return () => {
            channel?.close();
            window.removeEventListener('storage', onStorage);
        };
    }, [staffId]);

    return <StaffSelectionContext.Provider value={staffId}>{children}</StaffSelectionContext.Provider>;
}
