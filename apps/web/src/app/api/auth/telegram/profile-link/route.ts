import { handleApiError } from '@/lib/apiErrorHandler';
import { runTelegramProfileLinkHttp } from '@/lib/telegramProfileLinkHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
    let response: Response;
    try {
        response = await runTelegramProfileLinkHttp(req);
    } catch (error) {
        response = handleApiError(error, 'TelegramProfileLink', 'Подключение через бота временно недоступно');
    }
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
