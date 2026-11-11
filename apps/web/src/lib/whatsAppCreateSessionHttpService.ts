import { retiredWhatsAppAuthResponse } from '@/lib/retiredWhatsAppAuth';

export async function runWhatsAppCreateSessionHttp(_req: Request) {
    void _req;
    return retiredWhatsAppAuthResponse();
}
