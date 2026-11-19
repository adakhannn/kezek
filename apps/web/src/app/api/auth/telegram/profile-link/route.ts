import { handleApiError } from '@/lib/apiErrorHandler';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { runTelegramProfileLinkHttp } from '@/lib/telegramProfileLinkHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Every answer, the checks before the rate limit included, in the language of the request (FE-10).
export const POST = withLocalizedMessages(async function POST(req: Request) {
    let response: Response;
    try {
        response = await runTelegramProfileLinkHttp(req);
    } catch (error) {
        response = handleApiError(error, 'TelegramProfileLink', 'Подключение через бота временно недоступно');
    }
    response.headers.set('Cache-Control', 'no-store');
    return response;
});
