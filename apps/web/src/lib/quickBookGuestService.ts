import type { BookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { createConfirmedBooking, type BookingRequestSupabasePort } from '@/lib/bookingRequestService';

export type QuickBookGuestInput = {
    biz_id: string;
    branch_id: string;
    service_id: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
    client_name: string;
    client_phone: string;
    client_email?: string | null;
};
export type QuickBookGuestSupabasePort = BookingRequestSupabasePort;

export async function runQuickBookGuest(
    deps: { admin: QuickBookGuestSupabasePort; identity: BookingRequestIdentity },
    input: QuickBookGuestInput,
) {
    return createConfirmedBooking(deps.admin, deps.identity, input, null);
}
