import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Branch = {
    id: string;
    name: string;
    rating_score: number | null;
};

export type Service = {
    id: string;
    name_ru: string;
    /** services.name_ky/name_en (C6); shown in the app language with name_ru as the fallback. */
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    /** The home branch; a master may work at another branch on a given day (C5). */
    branch_id: string;
    rating_score: number | null;
    avatar_url: string | null;
};

type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    title_ky?: string | null;
    title_en?: string | null;
    params: Record<string, unknown>;
};

type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

type Business = {
    id: string;
    name: string;
    slug: string;
    /** businesses.tz (ARCH-11). */
    tz?: string | null;
    rating_score: number | null;
};

type BookingData = {
    business: Business | null;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    promotions: Promotion[];
    branchId: string;
    /** The selected services in the order they were chosen; several make one complex visit (C3). */
    serviceIds: string[];
    /** The first selected service (serviceIds[0] or ''), for single-service readers. */
    serviceId: string;
    /** A master's id or ANY_STAFF (screens/booking/bookingSelection.ts). */
    staffId: string;
    selectedDate: string;
    selectedSlot: Slot | null;
};

type BookingContextType = {
    bookingData: BookingData;
    hydrateInitialData: (data: Pick<BookingData, 'business' | 'branches'>) => void;
    setBusiness: (business: Business) => void;
    setBranches: (branches: Branch[]) => void;
    setServices: (services: Service[]) => void;
    setStaff: (staff: Staff[]) => void;
    setPromotions: (promotions: Promotion[]) => void;
    setBranchId: (id: string) => void;
    /** Selects exactly this service. */
    setServiceId: (id: string) => void;
    /** Adds the service to the selection, or removes it when it is already selected. */
    toggleServiceId: (id: string) => void;
    setStaffId: (id: string) => void;
    setSelectedDate: (date: string) => void;
    setSelectedSlot: (slot: Slot | null) => void;
    reset: () => void;
};

const initialState: BookingData = {
    business: null,
    branches: [],
    services: [],
    staff: [],
    promotions: [],
    branchId: '',
    serviceIds: [],
    serviceId: '',
    staffId: '',
    selectedDate: '',
    selectedSlot: null,
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

/**
 * `ownerId` is the signed-in user (RootNavigator). The provider sits above the signed-in/out
 * switch, so a draft would otherwise survive into the next account on the device (R25-05).
 * A guest draft (no owner) is kept when the guest signs in from the confirm step ("sign in
 * instead", C1): it holds no account data. Leaving a signed-in account always drops the draft.
 */
export function BookingProvider({ children, ownerId = null }: { children: ReactNode; ownerId?: string | null }) {
    const [bookingData, setBookingData] = useState<BookingData>(initialState);
    const [draftOwnerId, setDraftOwnerId] = useState(ownerId);
    if (draftOwnerId !== ownerId) {
        // Reset during render, so the next account never renders the previous draft.
        setDraftOwnerId(ownerId);
        if (draftOwnerId !== null) setBookingData(initialState);
    }

    const hydrateInitialData = useCallback(
        ({ business, branches }: Pick<BookingData, 'business' | 'branches'>) => {
            setBookingData({
                ...initialState,
                business,
                branches,
                branchId: branches.length === 1 ? branches[0].id : '',
            });
        },
        [],
    );

    const setBusiness = useCallback((business: Business) => {
        setBookingData((prev) => ({ ...prev, business }));
    }, []);

    const setBranches = useCallback((branches: Branch[]) => {
        setBookingData((prev) => ({ ...prev, branches }));
    }, []);

    const setServices = useCallback((services: Service[]) => {
        setBookingData((prev) => ({ ...prev, services }));
    }, []);

    const setStaff = useCallback((staff: Staff[]) => {
        setBookingData((prev) => ({ ...prev, staff }));
    }, []);

    const setPromotions = useCallback((promotions: Promotion[]) => {
        setBookingData((prev) => ({ ...prev, promotions }));
    }, []);

    const setBranchId = useCallback((id: string) => {
        setBookingData((prev) => ({
            ...prev,
            branchId: id,
            serviceIds: [],
            serviceId: '',
            staffId: '',
            selectedSlot: null,
        }));
    }, []);

    const setServiceId = useCallback((id: string) => {
        setBookingData((prev) => ({ ...prev, serviceIds: id ? [id] : [], serviceId: id, selectedSlot: null }));
    }, []);

    const toggleServiceId = useCallback((id: string) => {
        setBookingData((prev) => {
            const serviceIds = prev.serviceIds.includes(id)
                ? prev.serviceIds.filter((serviceId) => serviceId !== id)
                : [...prev.serviceIds, id];
            return { ...prev, serviceIds, serviceId: serviceIds[0] ?? '', selectedSlot: null };
        });
    }, []);

    const setStaffId = useCallback((id: string) => {
        setBookingData((prev) => ({ ...prev, staffId: id, selectedSlot: null }));
    }, []);

    const setSelectedDate = useCallback((date: string) => {
        setBookingData((prev) => ({ ...prev, selectedDate: date, selectedSlot: null }));
    }, []);

    const setSelectedSlot = useCallback((slot: Slot | null) => {
        setBookingData((prev) => ({ ...prev, selectedSlot: slot }));
    }, []);

    const reset = useCallback(() => {
        setBookingData(initialState);
    }, []);

    return (
        <BookingContext.Provider
            value={{
                bookingData,
                hydrateInitialData,
                setBusiness,
                setBranches,
                setServices,
                setStaff,
                setPromotions,
                setBranchId,
                setServiceId,
                toggleServiceId,
                setStaffId,
                setSelectedDate,
                setSelectedSlot,
                reset,
            }}
        >
            {children}
        </BookingContext.Provider>
    );
}

export function useBooking() {
    const context = useContext(BookingContext);
    if (context === undefined) {
        throw new Error('useBooking must be used within a BookingProvider');
    }
    return context;
}
