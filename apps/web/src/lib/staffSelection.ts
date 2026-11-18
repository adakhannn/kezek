/**
 * Which staff card the web cabinet and the mobile app act as (ARCH-02). A person can be an active
 * master in several businesses; requests name the card on screen, the web cabinet also remembers
 * the last chosen card. Dependency-free: imported by server code and client components.
 */

/** The web cabinet's remembered staff card (set by POST /api/me/current-staff, cleared on sign-out). */
export const STAFF_SELECTION_COOKIE = 'kezek_staff_id';

/** The staff card a request acts as; it must be one of the caller's active cards. */
export const STAFF_SELECTION_HEADER = 'x-kezek-staff-id';

/** BroadcastChannel name and localStorage key that tell other tabs the chosen card changed. */
export const STAFF_SELECTION_SIGNAL = 'kezek-staff-selection';

/** One of the caller's active staff cards with display names for the business chooser. */
export type StaffOptionLabel = {
    staffId: string;
    bizId: string;
    branchId: string | null;
    businessName: string | null;
    branchName: string | null;
};

/** Request headers that name the staff card on screen; empty outside the staff cabinet. */
export function staffSelectionHeaders(staffId: string | null | undefined): Record<string, string> {
    return staffId ? { [STAFF_SELECTION_HEADER]: staffId } : {};
}
