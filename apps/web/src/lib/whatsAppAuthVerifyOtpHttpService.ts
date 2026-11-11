import { retiredWhatsAppAuthResponse } from '@/lib/retiredWhatsAppAuth';

export async function runWhatsAppAuthVerifyOtpHttp(_req: Request) {
    void _req;
    return retiredWhatsAppAuthResponse();
}
