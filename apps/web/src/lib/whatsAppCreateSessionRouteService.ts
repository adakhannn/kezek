import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createWhatsAppSignInSession } from '@/lib/whatsAppCreateSessionService';
import type { WhatsAppSessionAdminClientLike } from '@/lib/whatsAppCreateSessionService';

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
        email: string;
        password: string;
        needsSignIn: true;
    };
};

export type WhatsAppCreateSessionRouteResult = Failure | Success;

export async function runWhatsAppCreateSessionRoute({
    admin,
    phone,
    userId,
}: {
    admin: WhatsAppSessionAdminClientLike;
    phone?: string;
    userId?: string;
}): Promise<WhatsAppCreateSessionRouteResult> {
    let phoneE164: string | undefined;
    if (phone) {
        phoneE164 = normalizePhoneToE164(phone) || undefined;
        if (!phoneE164) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: 'Неверный формат номера телефона',
                details: { code: 'invalid_phone' },
            };
        }
    }

    const result = await createWhatsAppSignInSession({
        admin,
        userId,
        phoneE164,
    });

    if (!result.ok) {
        return result;
    }

    return {
        ok: true,
        payload: result.data,
    };
}
