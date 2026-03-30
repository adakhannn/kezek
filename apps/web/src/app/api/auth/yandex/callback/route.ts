export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runYandexAuthCallbackHttp } from '@/lib/yandexAuthCallbackHttpService';

export async function GET(req: Request) {
    return withErrorHandler('YandexAuth', async () => runYandexAuthCallbackHttp(req));
}
