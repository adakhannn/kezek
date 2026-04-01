import { logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type ActiveBookingRow = {
    id: string;
    biz_id: string;
    start_at: string;
    services: { name_ru?: string }[] | { name_ru?: string } | null;
    staff: { full_name?: string }[] | { full_name?: string } | null;
    client_id?: string | null;
    client_phone?: string | null;
};

export type MessageContext = {
    clientId: string | null;
    activeBookings: ActiveBookingRow[];
    bizId: string | null;
};

export async function resolveWhatsAppMessageContext(
    normalizedPhone: string,
): Promise<MessageContext> {
    const admin = getServiceClient();
    let clientId: string | null = null;
    let activeBookings: ActiveBookingRow[] = [];
    let bizId: string | null = null;

    const { data: profile } = await admin
        .from('profiles')
        .select('id, phone')
        .eq('phone', normalizedPhone)
        .maybeSingle();

    if (profile) {
        clientId = profile.id;
        logDebug('WhatsAppWebhook', 'Found client by phone', {
            clientId,
            phone: normalizedPhone,
        });

        const { data: clientBookings } = await admin
            .from('bookings')
            .select(
                'id, biz_id, start_at, client_id, client_phone, services(name_ru), staff(full_name)',
            )
            .eq('client_id', clientId)
            .in('status', ['hold', 'confirmed', 'paid'])
            .gte('start_at', new Date().toISOString())
            .order('start_at', { ascending: true })
            .limit(10);

        if (clientBookings?.length) {
            activeBookings = clientBookings as unknown as ActiveBookingRow[];
            bizId = activeBookings[0].biz_id;
            logDebug('WhatsAppWebhook', 'Found active bookings', {
                count: activeBookings.length,
                bizId,
            });
        } else {
            const { data: lastBooking } = await admin
                .from('bookings')
                .select('biz_id')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastBooking) {
                bizId = lastBooking.biz_id;
            }
        }

        return { clientId, activeBookings, bizId };
    }

    const { data: guestBookings } = await admin
        .from('bookings')
        .select(
            'id, biz_id, start_at, client_id, client_phone, services(name_ru), staff(full_name)',
        )
        .eq('client_phone', normalizedPhone)
        .in('status', ['hold', 'confirmed', 'paid'])
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(10);

    if (guestBookings?.length) {
        activeBookings = guestBookings as unknown as ActiveBookingRow[];
        bizId = activeBookings[0].biz_id;
        logDebug('WhatsAppWebhook', 'Found guest bookings by phone', {
            count: activeBookings.length,
            bizId,
        });
    }

    return { clientId, activeBookings, bizId };
}
