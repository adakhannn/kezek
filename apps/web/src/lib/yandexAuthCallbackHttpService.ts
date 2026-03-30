import { NextResponse } from 'next/server';

import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';

export async function runYandexAuthCallbackHttp(req: Request): Promise<NextResponse> {
    const result = await runYandexAuthCallbackRoute({
        requestUrl: req.url,
        env: process.env,
    });

    return NextResponse.redirect(result.redirectUrl);
}
