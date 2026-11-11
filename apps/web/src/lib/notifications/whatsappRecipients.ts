import type { ParticipantData } from './types';

import { normalizePhoneToE164 } from '@/lib/senders/sms';

export function whatsappRecipientPhone(role: 'client' | 'staff' | 'owner', data: ParticipantData): string | null {
    if (!data.whatsappPhone || !data.notifyWhatsApp || (role === 'client' && !data.whatsappVerified)) return null;
    return normalizePhoneToE164(data.whatsappPhone);
}
