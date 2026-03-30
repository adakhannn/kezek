import { normalizePhoneToE164 } from '@/lib/senders/sms';
import {
    verifyWhatsAppOtpLogin,
    type SupabaseAdminClientLike,
} from '@/lib/whatsAppAuthVerifyOtpService';

type Failure = {
    ok: false;
    status: number;
    error: string;
    message: string;
    details?: unknown;
};

type Success = {
    ok: true;
    payload: {
        message: string;
        userId: string;
        phone: string;
        isNewUser: boolean;
    };
};

export type WhatsAppAuthVerifyOtpRouteResult = Failure | Success;

export async function runWhatsAppAuthVerifyOtpRoute({
    admin,
    phone,
    code,
}: {
    admin: SupabaseAdminClientLike;
    phone: string;
    code: string;
}): Promise<WhatsAppAuthVerifyOtpRouteResult> {
    const phoneE164 = normalizePhoneToE164(phone);

    if (!phoneE164) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный формат номера телефона',
            details: { code: 'invalid_phone' },
        };
    }

    const result = await verifyWhatsAppOtpLogin({
        admin,
        phoneE164,
        code,
    });

    if (!result.ok) {
        return result;
    }

    return {
        ok: true,
        payload: result.data,
    };
}
