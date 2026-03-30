import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import {
    sendWhatsAppAuthOtp,
    type WhatsAppAuthSendOtpAdminLike,
} from '@/lib/whatsAppAuthSendOtpService';

export type WhatsAppAuthSendOtpRouteResult = Awaited<
    ReturnType<typeof sendWhatsAppAuthOtp>
>;

export async function runWhatsAppAuthSendOtpRoute({
    admin,
    phone,
}: {
    admin: WhatsAppAuthSendOtpAdminLike;
    phone?: string;
}): Promise<WhatsAppAuthSendOtpRouteResult> {
    return sendWhatsAppAuthOtp({
        admin,
        phone,
        normalizePhone: normalizePhoneToE164,
        sendMessage: sendWhatsApp,
    });
}
