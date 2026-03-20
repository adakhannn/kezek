import { logError } from '@/lib/log';

export type FinanceByIdBooking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: {
        name_ru: string;
        name_ky: string | null;
        name_en: string | null;
    } | null;
};

export type FinanceByIdService = {
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
};

type ServiceJoinValue = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
};

type BookingsClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type ServicesClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type LoadFinanceByIdRelatedDataInput = {
    supabase: BookingsClient & ServicesClient;
    staffId: string;
    ymd: string;
};

function normalizeService(value: ServiceJoinValue | ServiceJoinValue[] | null): FinanceByIdService | null {
    const service = Array.isArray(value)
        ? (value.length > 0 ? value[0] : null)
        : value;

    if (!service || typeof service.name_ru !== 'string' || service.name_ru.length === 0) {
        return null;
    }

    return {
        name_ru: service.name_ru,
        name_ky: typeof service.name_ky === 'string' ? service.name_ky : null,
        name_en: typeof service.name_en === 'string' ? service.name_en : null,
    };
}

export async function loadFinanceByIdRelatedData(
    input: LoadFinanceByIdRelatedDataInput
): Promise<{ bookings: FinanceByIdBooking[]; services: FinanceByIdService[] }> {
    const { supabase, staffId, ymd } = input;
    const dateStart = `${ymd}T00:00:00`;
    const dateEnd = `${ymd}T23:59:59`;

    const [bookingsResult, servicesResult] = await Promise.all([
        supabase
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .gte('start_at', dateStart)
            .lte('start_at', dateEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true }),
        supabase
            .from('service_staff')
            .select('services:services!inner (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .eq('services.active', true),
    ]);

    if (bookingsResult.error) {
        logError('StaffFinance', 'Error loading bookings', bookingsResult.error);
    }

    if (servicesResult.error) {
        logError('StaffFinance', 'Error loading staff services', servicesResult.error);
    }

    const bookings = (Array.isArray(bookingsResult.data) ? bookingsResult.data : []).map((booking: {
        id: string;
        client_name: string | null;
        client_phone: string | null;
        start_at: string;
        services: ServiceJoinValue | ServiceJoinValue[] | null;
    }) => ({
        id: booking.id,
        client_name: booking.client_name,
        client_phone: booking.client_phone,
        start_at: booking.start_at,
        services: normalizeService(booking.services),
    }));

    const services = (Array.isArray(servicesResult.data) ? servicesResult.data : [])
        .map((row: { services: ServiceJoinValue | ServiceJoinValue[] | null }) => normalizeService(row.services))
        .filter((service: FinanceByIdService | null): service is FinanceByIdService => service !== null);

    return { bookings, services };
}
