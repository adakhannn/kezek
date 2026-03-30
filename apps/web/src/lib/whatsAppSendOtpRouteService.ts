import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import {
    sendProfileWhatsAppOtp,
    type WhatsAppSendOtpResult,
    type WhatsAppSendOtpSupabaseLike,
} from '@/lib/whatsAppSendOtpService';

export type WhatsAppSendOtpRouteResult = WhatsAppSendOtpResult;

export async function runWhatsAppSendOtpRoute({
    supabase,
}: {
    supabase: WhatsAppSendOtpSupabaseLike;
}): Promise<WhatsAppSendOtpRouteResult> {
    return sendProfileWhatsAppOtp({
        supabase,
        normalizePhone: normalizePhoneToE164,
        sendMessage: sendWhatsApp,
    });
}
