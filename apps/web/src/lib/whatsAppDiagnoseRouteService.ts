import { diagnoseWhatsAppSetup } from '@/lib/whatsAppDiagnoseService';

type Failure = {
    ok: false;
    status: 500;
    error: 'internal';
    message: string;
    details?: Record<string, unknown>;
};

type Success = {
    ok: true;
    payload: unknown;
};

export type WhatsAppDiagnoseRouteResult = Failure | Success;

export async function runWhatsAppDiagnoseRoute({
    env,
}: {
    env: NodeJS.ProcessEnv;
}): Promise<WhatsAppDiagnoseRouteResult> {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'WHATSAPP_ACCESS_TOKEN не установлен',
            details: { code: 'no_token' },
        };
    }

    const result = await diagnoseWhatsAppSetup({
        accessToken,
        phoneNumberId,
    });

    return {
        ok: true,
        payload: result,
    };
}
