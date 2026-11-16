import {
    getWhatsAppAuthTemplateLanguage,
    getWhatsAppAuthTemplateName,
    hasUsableWhatsAppOtpHashSecret,
} from '@/lib/env';
import { createProfileWhatsAppOtpStore, type ProfileWhatsAppOtpStore } from '@/lib/profileWhatsAppOtpStore';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { hashWhatsappOtp } from '@/lib/whatsAppOtpHash';
import {
    sendProfileWhatsAppOtp,
    type WhatsAppSendOtpResult,
    type WhatsAppSendOtpSupabaseLike,
} from '@/lib/whatsAppSendOtpService';

export type WhatsAppSendOtpRouteResult = WhatsAppSendOtpResult;

export async function runWhatsAppSendOtpRoute({
    supabase,
    phone,
    otpStore,
}: {
    supabase: WhatsAppSendOtpSupabaseLike;
    phone?: string;
    otpStore?: ProfileWhatsAppOtpStore;
}): Promise<WhatsAppSendOtpRouteResult> {
    if (!hasUsableWhatsAppOtpHashSecret()) {
        return {
            ok: false,
            error: 'internal',
            message: 'Отправка кода WhatsApp временно недоступна',
            details: { code: 'otp_secret_not_configured' },
            status: 503,
        };
    }

    return sendProfileWhatsAppOtp({
        supabase,
        phone,
        normalizePhone: normalizePhoneToE164,
        sendMessage: sendWhatsApp,
        authTemplateName: getWhatsAppAuthTemplateName(),
        authTemplateLanguage: getWhatsAppAuthTemplateLanguage(),
        requireTemplate: true,
        otpStore: otpStore ?? createProfileWhatsAppOtpStore(createSupabaseAdminClient()),
        hashOtp: hashWhatsappOtp,
    });
}
