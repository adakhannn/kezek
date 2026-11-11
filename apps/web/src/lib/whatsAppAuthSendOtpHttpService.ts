import { retiredWhatsAppAuthResponse } from '@/lib/retiredWhatsAppAuth';

export async function runWhatsAppAuthSendOtpHttp(_req: Request) {
    void _req;
    return retiredWhatsAppAuthResponse();
}
