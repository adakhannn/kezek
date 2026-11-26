import { NextResponse } from 'next/server';

import { getYandexMapsApiKey } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * The website's public map settings for the mobile app's WebView maps (the branch map picker).
 * The Yandex Maps key is NEXT_PUBLIC_* — already shipped in the website's JS bundle and limited by
 * its allowed-referrer rule — so returning it here discloses nothing new. Null when not configured.
 */
export async function GET() {
    return NextResponse.json(
        { ok: true, data: { yandexMapsApiKey: getYandexMapsApiKey() ?? null } },
        { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
}
