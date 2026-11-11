import { acknowledgeBookingRequest, getBookingRequestHeaders } from '@/lib/bookingRequestClient';
import type { InternalBookingInput } from '@/lib/internalBookingSchema';
import { supabase } from '@/lib/supabaseClient';

export async function postInternalBooking(input: InternalBookingInput): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Войдите в аккаунт для создания записи');
    // Session identity only namespaces browser storage. The server revalidates
    // the bearer and derives the actor; it never trusts this local user object.
    const identityInput = { kind: 'internal', actor: data.session.user.id, payload: input };
    const identity = await getBookingRequestHeaders(identityInput, false);
    const response = await fetch('/api/bookings/internal', { method: 'POST', headers: {
        'content-type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...identity,
    }, body: JSON.stringify(input) });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true || body?.data?.confirmed !== true || typeof body?.data?.booking_id !== 'string') {
        throw new Error(typeof body?.message === 'string' ? body.message : 'Результат записи не подтверждён. Повторите ту же запись.');
    }
    try { await acknowledgeBookingRequest(identityInput, false, identity); } catch { /* A retained key safely replays the receipt. */ }
    return body.data.booking_id;
}
