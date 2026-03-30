import {
    verifyExistingWhatsAppOtp,
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
    code,
}: {
    supabase: SupabaseServerClientLike;
    code?: string;
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

    return verifyExistingWhatsAppOtp({
        supabase,
        user,
        code,
    });
}
