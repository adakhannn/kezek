export type CabinetService = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
};

export type CabinetVisitService = {
    duration_min: number | null;
    service: CabinetService | CabinetService[] | null;
};

/** Visit rows are the historical source; the primary FK is legacy fallback only. */
export function cabinetBookingServices(booking: {
    services?: CabinetService | CabinetService[] | null;
    booking_services?: CabinetVisitService[] | null;
}): CabinetService[] {
    const visit = (booking.booking_services ?? []).flatMap(row => {
        const service = Array.isArray(row.service) ? row.service[0] : row.service;
        return service ? [{...service, duration_min: row.duration_min ?? service.duration_min}] : [];
    });
    if (visit.length) return visit;
    return Array.isArray(booking.services) ? booking.services : booking.services ? [booking.services] : [];
}
