import { getWhatsAppAuthTemplateLanguage, getWhatsAppAuthTemplateName } from '@/lib/env';
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
    phone,
}: {
    supabase: WhatsAppSendOtpSupabaseLike;
    phone?: string;
}): Promise<WhatsAppSendOtpRouteResult> {
    return sendProfileWhatsAppOtp({
        supabase,
        phone,
        normalizePhone: normalizePhoneToE164,
        sendMessage: sendWhatsApp,
        authTemplateName: getWhatsAppAuthTemplateName(),
        authTemplateLanguage: getWhatsAppAuthTemplateLanguage(),
        requireTemplate: true,
    });
}
