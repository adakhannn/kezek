import { hasUsableWhatsAppOtpHashSecret } from '@/lib/env';
import { createProfileWhatsAppOtpStore, type ProfileWhatsAppOtpStore } from '@/lib/profileWhatsAppOtpStore';
import { hashWhatsappOtp, secureEqualHex } from '@/lib/whatsAppOtpHash';
import {
    verifyExistingWhatsAppOtp,
    type ProfileIdentityWriter,
    type SupabaseServerClientLike,
} from '@/lib/whatsAppVerifyOtpService';

type Failure = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

type Success = {
    ok: true;
    data: {
        message: string;
    };
};

export type WhatsAppVerifyOtpRouteResult = Failure | Success;

export async function runWhatsAppVerifyOtpRoute({
    supabase,
    admin,
    code,
    findAuthOwnerByPhone,
    otpStore,
}: {
    supabase: SupabaseServerClientLike;
    /** Service-role client: identity columns are not writable with a user session. */
    admin: ProfileIdentityWriter & Parameters<typeof createProfileWhatsAppOtpStore>[0];
    code?: string;
    findAuthOwnerByPhone: (phone: string) => Promise<string | null>;
    otpStore?: ProfileWhatsAppOtpStore;
}): Promise<WhatsAppVerifyOtpRouteResult> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        };
    }

    if (!hasUsableWhatsAppOtpHashSecret()) {
        return {
            ok: false,
            error: 'internal',
            message: 'Подтверждение WhatsApp временно недоступно',
            details: { code: 'otp_secret_not_configured' },
            status: 503,
        };
    }

    return verifyExistingWhatsAppOtp({
        user,
        code,
        findAuthOwnerByPhone,
        otpStore: otpStore ?? createProfileWhatsAppOtpStore(admin),
        hashOtp: hashWhatsappOtp,
        secureEqual: secureEqualHex,
        profileWriter: admin,
    });
}
