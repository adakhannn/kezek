import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Branch = {
    id: string;
    name: string;
};

type Service = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    branch_id: string;
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
};

type BookingData = {
    business: Business | null;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    branchId: string;
    serviceId: string;
    staffId: string;
    selectedDate: string;
    selectedSlot: Slot | null;
};

type BookingContextType = {
    bookingData: BookingData;
    setBusiness: (business: Business) => void;
    setBranches: (branches: Branch[]) => void;
    setServices: (services: Service[]) => void;
    setStaff: (staff: Staff[]) => void;
    setBranchId: (id: string) => void;
    setServiceId: (id: string) => void;
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
    branchId: '',
    serviceId: '',
    staffId: '',
    selectedDate: '',
    selectedSlot: null,
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
    const [bookingData, setBookingData] = useState<BookingData>(initialState);

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

    const setBranchId = useCallback((id: string) => {
        setBookingData((prev) => ({ ...prev, branchId: id, serviceId: '', staffId: '', selectedSlot: null }));
    }, []);

    const setServiceId = useCallback((id: string) => {
        setBookingData((prev) => ({ ...prev, serviceId: id, selectedSlot: null }));
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
                setBusiness,
                setBranches,
                setServices,
                setStaff,
                setBranchId,
                setServiceId,
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

